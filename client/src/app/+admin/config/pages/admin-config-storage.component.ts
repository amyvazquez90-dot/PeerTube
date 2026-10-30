import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Notifier, ServerService } from '@app/core'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { UserUpdate } from '@peertube/peertube-models'
import { switchMap } from 'rxjs/operators'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { BytesPipe } from '../../../shared/shared-main/common/bytes.pipe'
import { getVideoQuotaOptions } from '../../shared/user-quota-options'

type StorageMode = 'limited' | 'unlimited'

@Component({
  selector: 'my-admin-config-storage',
  templateUrl: './admin-config-storage.component.html',
  styleUrls: [ './admin-config-storage.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, BytesPipe ]
})
export class AdminConfigStorageComponent implements OnInit {
  private adminConfigService = inject(AdminConfigService)
  private userAdminService = inject(UserAdminService)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)

  mode: StorageMode = 'unlimited'
  limitedQuota = 5 * 1024 * 1024 * 1024
  applyToExistingUsers = true
  saving = false

  // Real values read from the API, never hardcoded
  usedStorage = 0
  totalLocalVideos = 0
  statsLoaded = false

  quotaOptions = getVideoQuotaOptions().filter(option => option.id > 0)

  ngOnInit () {
    const { user } = this.serverService.getHTMLConfig()

    if (user.videoQuota === -1) {
      this.mode = 'unlimited'
    } else {
      this.mode = 'limited'
      this.limitedQuota = user.videoQuota
    }

    this.loadUsage()
  }

  save () {
    const videoQuota = this.mode === 'unlimited'
      ? -1
      : Number(this.limitedQuota)

    this.saving = true

    const partialConfig = this.mode === 'unlimited'
      ? { user: { videoQuota, videoQuotaDaily: -1 } }
      : { user: { videoQuota } }

    this.adminConfigService.updateCustomConfig(partialConfig)
      .pipe(switchMap(() => this.serverService.resetConfig()))
      .subscribe({
        next: () => {
          if (this.applyToExistingUsers) this.applyToAllUsers(videoQuota)
          else this.onSaved()
        },

        error: err => {
          this.saving = false
          this.notifier.handleError(err)
        }
      })
  }

  private applyToAllUsers (videoQuota: number) {
    const userUpdate: UserUpdate = { videoQuota }
    const count = 100

    const applyPage = (start: number) => {
      this.userAdminService.listUsers({
        pagination: { start, count },
        sort: { field: 'id', order: 1 }
      }).subscribe({
        next: res => {
          if (res.data.length !== 0) {
            this.userAdminService.updateUsers(res.data, userUpdate)
              .subscribe({ error: err => this.notifier.handleError(err) })
          }

          if (start + count < res.total) applyPage(start + count)
          else this.onSaved()
        },

        error: err => {
          this.saving = false
          this.notifier.handleError(err)
        }
      })
    }

    applyPage(0)
  }

  private onSaved () {
    this.saving = false

    this.notifier.success($localize`Storage settings saved.`)
    this.loadUsage()
  }

  private loadUsage () {
    this.serverService.getServerStats().subscribe({
      next: stats => {
        this.usedStorage = stats.totalLocalVideoFilesSize
        this.totalLocalVideos = stats.totalLocalVideos
        this.statsLoaded = true
      },

      // Stats are informational: a failure must not block the storage settings
      error: () => { this.statsLoaded = false }
    })
  }
}
