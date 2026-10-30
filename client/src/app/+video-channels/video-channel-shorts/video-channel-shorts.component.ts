import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { ComponentPaginationLight, DisableForReuseHook, ScreenService } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { SHORTS_TAG } from '@app/shared/shared-shorts/shorts'
import { VideoFilters } from '@app/shared/shared-video-miniature/video-filters.model'
import { VideosListComponent } from '@app/shared/shared-video-miniature/videos-list.component'
import { VideoSortField } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-video-channel-shorts',
  templateUrl: './video-channel-shorts.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ VideosListComponent ]
})
export class VideoChannelShortsComponent implements OnInit, OnDestroy, DisableForReuseHook {
  private screenService = inject(ScreenService)
  private videoChannelService = inject(VideoChannelService)
  private videoService = inject(VideoService)

  readonly videosList = viewChild<VideosListComponent>('videosList')

  getVideosObservableFunction = this.getVideosObservable.bind(this)

  defaultSort = '-publishedAt' as VideoSortField

  videoChannel: VideoChannel
  disabled = false

  private videoChannelSub: Subscription
  private alreadyLoaded = false

  ngOnInit () {
    // Parent gets the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => {
        if (this.videoChannel?.id === videoChannel.id) return

        this.videoChannel = videoChannel
        if (this.alreadyLoaded) this.videosList().reloadVideos()

        this.alreadyLoaded = true
      })
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    return this.videoService.listChannelVideos({
      ...filters.toVideosAPIObject(),

      videoPagination: pagination,
      videoChannel: this.videoChannel,
      tagsAllOf: [ SHORTS_TAG ],
      skipCount: true
    })
  }

  displayAsRow () {
    return this.screenService.isInMobileView()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }
}
