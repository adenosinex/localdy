// 视频播放控制模块
export class VideoPlayer {
    constructor(state, refs) {
        this.state = state
        this.refs = refs
        this.touchStartY = 0
        this.touchActive = false
        this.lastRatios = [] // 记录最近3次视频比例
    }

    // 更新视频显示类别（横屏/竖屏）
    updateVideoClass(videoEl = null) {
        if (!videoEl) {
            const videos = document.querySelectorAll('video')
            videoEl = videos[this.refs.activeVideoIndex.value]
        }

        let isLandscape = false
        if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
            isLandscape = videoEl.videoHeight / videoEl.videoWidth <= 1.1
            // 记录比例
            this.lastRatios.push(isLandscape)
            if (this.lastRatios.length > 3) this.lastRatios.shift()
            // 判断最近3次是否全为横屏
            if (this.lastRatios.length === 3 && this.lastRatios.every(v => v)) {
                this.refs.videoClass.value = 'video-landscape'
            } else if (!isLandscape) {
                this.refs.videoClass.value = 'video-portrait'
            } else {
                this.refs.videoClass.value = 'video-landscape'
            }
        } else {
            // 未检测到宽高，按最近3次判断
            if (this.lastRatios.length === 3 && this.lastRatios.every(v => v)) {
                this.refs.videoClass.value = 'video-landscape'
            } else {
                this.refs.videoClass.value = 'video-portrait'
            }
        }
    }

    // 初始化视频队列
    initializeVideoQueue() {
        if (this.state.videos.length === 0) return

        this.refs.videoQueue.value = []
        this.refs.activeVideoIndex.value = 1
        this.refs.videoLoadStates.value = [false, false, false]

        // Fill the queue with 3 videos
        for (let i = 0; i < 3; i++) {
            const videoIndex = (this.refs.currentIndex.value - 1 + i + this.state.videos.length) % this.state.videos.length
            if (this.state.videos[videoIndex]) {
                this.refs.videoQueue.value.push(this.state.videos[videoIndex])
            }
        }
    }

    // 更新视频队列
    updateVideoQueue(direction = 'next') {
        if (this.state.videos.length === 0) return

        if (direction === 'next') {
            // Remove first video, shift others, add new video at the end
            this.refs.videoQueue.value.shift()
            const nextVideoIndex = (this.refs.currentIndex.value + 1) % this.state.videos.length
            if (this.state.videos[nextVideoIndex]) {
                this.refs.videoQueue.value.push(this.state.videos[nextVideoIndex])
            }
        } else {
            // Remove last video, unshift others, add new video at the beginning
            this.refs.videoQueue.value.pop()
            const prevVideoIndex = (this.refs.currentIndex.value - 2 + this.state.videos.length) % this.state.videos.length
            if (this.state.videos[prevVideoIndex]) {
                this.refs.videoQueue.value.unshift(this.state.videos[prevVideoIndex])
            }
        }

        // Reset load states
        this.refs.videoLoadStates.value = [false, false, false]
    }

    // 退出全屏
    exitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.error(`退出全屏失败: ${err.message}`)
            })
        }
    }

    // 上一个视频
    prevVideo() {
        if (this.state.videos.length === 0) return

        // Pause current video
        const currentVideo = document.querySelectorAll('video')[this.refs.activeVideoIndex.value]
        if (currentVideo) {
            currentVideo.pause()
            currentVideo.muted = true
        }

        // Update current index
        this.refs.currentIndex.value = (this.refs.currentIndex.value - 1 + this.state.videos.length) % this.state.videos.length

        // Update video queue
        this.updateVideoQueue('prev')

        // Play the middle video (index 1) after a short delay
        setTimeout(() => {
            this.playActiveVideo()
        }, 200)
    }

    // 下一个视频
    async nextVideo() {
        if (this.state.videos.length === 0) return
        this.exitFullscreen()
        
        // Pause current video
        const currentVideo = document.querySelectorAll('video')[this.refs.activeVideoIndex.value]
        if (currentVideo) {
            currentVideo.pause()
            currentVideo.muted = true
        }

        // Check if we need to load more videos
        if (this.refs.currentIndex.value >= this.state.videos.length - 2) {
            this.state.page++
            await this.loadMoreVideos()
        }

        // Update current index
        this.refs.currentIndex.value = (this.refs.currentIndex.value + 1) % this.state.videos.length

        // Update video queue
        this.updateVideoQueue('next')

        // Play the middle video (index 1) after a short delay
        setTimeout(() => {
            this.playActiveVideo()
        }, 200)
    }

    // 暂停所有视频
    pauseAllVideos() {
        const videos = document.querySelectorAll('video')
        videos.forEach((video, index) => {
            if (index !== this.refs.activeVideoIndex.value) {
                video.pause()
                video.muted = true
            }
        })
    }

    // 播放当前活动视频
    playActiveVideo() {
        const videos = document.querySelectorAll('video')
        if (videos[this.refs.activeVideoIndex.value]) {
            const activeVideo = videos[this.refs.activeVideoIndex.value]

            // Only unmute and play, don't restart from beginning
            activeVideo.muted = false

            // Only restart if video hasn't started playing yet or is at the end
            if (activeVideo.currentTime === 0 || activeVideo.ended) {
                activeVideo.currentTime = 0
            }

            activeVideo.play().catch(e => console.log('Play failed:', e))

            // Update video class based on dimensions (only once when metadata loads)
            if (!activeVideo.hasAttribute('data-class-updated')) {
                activeVideo.onloadedmetadata = () => {
                    this.updateVideoClass(activeVideo)
                    activeVideo.setAttribute('data-class-updated', 'true')
                }
                if (activeVideo.readyState >= 1) {
                    this.updateVideoClass(activeVideo)
                    activeVideo.setAttribute('data-class-updated', 'true')
                }
            }
        }
    }

    // 自动播放视频
    autoPlayVideo() {
        // Only play if video is not already playing
        const videos = document.querySelectorAll('video')
        const activeVideo = videos[this.refs.activeVideoIndex.value]
        if (activeVideo && activeVideo.paused) {
            setTimeout(() => {
                this.playActiveVideo()
            }, 300)
        }
    }

    // 视频加载完成回调
    onVideoLoaded(index) {
        this.refs.videoLoadStates.value[index] = true
    }

    // 视频准备就绪回调
    onVideoReady(index) {
        // Video is ready to play
        this.refs.videoLoadStates.value[index] = true

        // Only auto-play if this is the active video and it's not already playing
        if (index === this.refs.activeVideoIndex.value) {
            const videos = document.querySelectorAll('video')
            const video = videos[index]
            if (video && video.paused && !video.muted) {
                setTimeout(() => {
                    video.play().catch(e => console.log('Auto-play failed:', e))
                }, 100)
            }
        }
    }

    // 触摸开始处理
    handleTouchStart(e) {
        const videoEl = document.elementFromPoint(
            e.touches[0].clientX,
            e.touches[0].clientY
        )
        if (videoEl && videoEl.tagName === 'VIDEO') {
            this.touchActive = true
            this.touchStartY = e.touches[0].clientY
        } else {
            this.touchActive = false
        }
    }

    // 触摸结束处理
    handleTouchEnd(e) {
        if (!this.touchActive) return
        const deltaY = e.changedTouches[0].clientY - this.touchStartY
        if (Math.abs(deltaY) > 50) {
            if (deltaY < 0) this.nextVideo()
            else this.prevVideo()
        }
        this.touchActive = false
    }

    // 获取当前播放的视频元素
    getCurrentlyPlayingVideo() {
        const videos = document.querySelectorAll('video')
        for (const video of videos) {
            if (!video.paused && !video.ended) {
                return video
            }
        }
        return null
    }

    // 设置加载更多视频的回调
    setLoadMoreVideos(callback) {
        this.loadMoreVideos = callback
    }

    // 初始化事件监听器
    initEventListeners() {
        // 鼠标滚轮切换视频
        window.addEventListener('wheel', (e) => {
            if (e.deltaY > 0) this.nextVideo()
            else if (e.deltaY < 0) this.prevVideo()
        })

        // 双击全屏
        window.addEventListener('dblclick', (e) => {
            const videoElement = this.getCurrentlyPlayingVideo()

            if (!document.fullscreenElement) {
                if (videoElement && videoElement.requestFullscreen) {
                    videoElement.requestFullscreen().catch(err => {
                        console.error(`进入全屏失败: ${err.message}`)
                    })
                }
            }
        })

        // 键盘上下方向键切换视频
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') this.nextVideo()
            else if (e.key === 'ArrowUp') this.prevVideo()
        })
    }
}
