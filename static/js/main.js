import { fetchLatestVideos, getVideoUrl } from './api_base.js'
import { updateScore } from './api_modify.js'
import { searchVideos } from './api_search.js'

const { createApp, reactive, onMounted, computed, ref, watch } = Vue
 



async function getTotalPages(pageSize, searchKeyword = '', searchScore = 0) {
    // 获取总视频数
    const params = []
    if (searchKeyword) params.push(`search=${encodeURIComponent(searchKeyword)}`)
    if (searchScore && searchScore > 0) params.push(`score=${searchScore}`)
    const url = `/videos/count${params.length ? '?' + params.join('&') : ''}`
    const resp = await axios.get(url)
    const total = resp.data.total || 0
    return Math.max(1, Math.ceil(total / pageSize))
} 
createApp({
    setup() {
        const state = reactive({
            videos: [],
            page: 1,
            pageSize: 10,
        })
        const currentIndex = ref(0)
        const showDetail = ref(false)
        const showSearch = ref(false)
        const showConfig = ref(false)
        const searchKeyword = ref('')
        const searchScore = ref(0)
        const newPath = ref('')
        const pathList = ref([])
        let touchStartY = 0
        let touchActive = false

        // 3-video preloading system
        const videoQueue = ref([])
        const activeVideoIndex = ref(1) // Middle video is active
        const videoLoadStates = ref([false, false, false])
        const isLoading = ref(true) // Loading state for initial UI

        const currentVideo = computed(() => {
            if (videoQueue.value.length > 0 && activeVideoIndex.value < videoQueue.value.length) {
                return videoQueue.value[activeVideoIndex.value] || {}
            }
            return state.videos[currentIndex.value] || {}
        })

        const videoClass = ref('video-portrait')
        const lastRatios = ref([]) // 记录最近3次视频比例

        
        function updateVideoClass(videoEl = null) {
            if (!videoEl) {
                const videos = document.querySelectorAll('video')
                videoEl = videos[activeVideoIndex.value]
            }

            let isLandscape = false
            if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
                isLandscape = videoEl.videoHeight / videoEl.videoWidth <= 1.1
                // 记录比例
                lastRatios.value.push(isLandscape)
                if (lastRatios.value.length > 3) lastRatios.value.shift()
                // 判断最近3次是否全为横屏
                if (lastRatios.value.length === 3 && lastRatios.value.every(v => v)) {
                    videoClass.value = 'video-landscape'
                } else if (!isLandscape) {
                    videoClass.value = 'video-portrait'
                } else {
                    videoClass.value = 'video-landscape'
                }
            } else {
                // 未检测到宽高，按最近3次判断
                if (lastRatios.value.length === 3 && lastRatios.value.every(v => v)) {
                    videoClass.value = 'video-landscape'
                } else {
                    videoClass.value = 'video-portrait'
                }
            }
        }

        async function loadVideos(append = false) {
            const newVideos = await fetchLatestVideos(state)
            if (append) {
                state.videos.push(...newVideos)
            } else {
                state.videos = newVideos
                currentIndex.value = 0
            }
            // Initialize video queue after loading videos
            initializeVideoQueue()
        }

        function initializeVideoQueue() {
            if (state.videos.length === 0) return

            videoQueue.value = []
            activeVideoIndex.value = 1
            videoLoadStates.value = [false, false, false]

            // Fill the queue with 3 videos
            for (let i = 0; i < 3; i++) {
                const videoIndex = (currentIndex.value - 1 + i + state.videos.length) % state.videos.length
                if (state.videos[videoIndex]) {
                    videoQueue.value.push(state.videos[videoIndex])
                }
            }
        }

        function updateVideoQueue(direction = 'next') {
            if (state.videos.length === 0) return

            if (direction === 'next') {
                // Remove first video, shift others, add new video at the end
                videoQueue.value.shift()
                const nextVideoIndex = (currentIndex.value + 1) % state.videos.length
                if (state.videos[nextVideoIndex]) {
                    videoQueue.value.push(state.videos[nextVideoIndex])
                }
            } else {
                // Remove last video, unshift others, add new video at the beginning
                videoQueue.value.pop()
                const prevVideoIndex = (currentIndex.value - 2 + state.videos.length) % state.videos.length
                if (state.videos[prevVideoIndex]) {
                    videoQueue.value.unshift(state.videos[prevVideoIndex])
                }
            }

            // Reset load states
            videoLoadStates.value = [false, false, false]
        }

        async function initialLoad() {
            try {
                isLoading.value = true
                // 获取总页数，随机选择一个页码
                const totalPages = await getTotalPages(state.pageSize)
                state.page = Math.floor(Math.random() * totalPages) + 1
                await loadVideos(false)
                showSearch.value = false // 首屏不显示搜索弹窗
                showConfig.value = false // 首屏不显示配置弹窗

                // Wait a bit for videos to initialize, then hide loading
                setTimeout(() => {
                    isLoading.value = false
                    // Start playing the first video after loading is complete
                    setTimeout(() => {
                        playActiveVideo()
                    }, 500)
                }, 1500)
            } catch (error) {
                console.error('Initial load failed:', error)
                isLoading.value = false
            }
        }

        function prevVideo() {
            if (state.videos.length === 0) return

            // Pause current video
            const currentVideo = document.querySelectorAll('video')[activeVideoIndex.value]
            if (currentVideo) {
                currentVideo.pause()
                currentVideo.muted = true
            }

            // Update current index
            currentIndex.value = (currentIndex.value - 1 + state.videos.length) % state.videos.length

            // Update video queue
            updateVideoQueue('prev')

            // Play the middle video (index 1) after a short delay
            setTimeout(() => {
                playActiveVideo()
            }, 200)
        }
        function exitFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => {
                    console.error(`退出全屏失败: ${err.message}`);
                });
            }
        }
        async function nextVideo() {
            if (state.videos.length === 0) return
            exitFullscreen()
            // Pause current video
            const currentVideo = document.querySelectorAll('video')[activeVideoIndex.value]
            if (currentVideo) {
                currentVideo.pause()
                currentVideo.muted = true
            }

            // Check if we need to load more videos
            if (currentIndex.value >= state.videos.length - 2) {
                state.page++
                await loadVideos(true)
            }

            // Update current index
            currentIndex.value = (currentIndex.value + 1) % state.videos.length

            // Update video queue
            updateVideoQueue('next')

            // Play the middle video (index 1) after a short delay
            setTimeout(() => {
                playActiveVideo()
            }, 200)
        }

        function toggleDetail() {
            showDetail.value = !showDetail.value
        }

        function handleTouchStart(e) {
            const videoEl = document.elementFromPoint(
                e.touches[0].clientX,
                e.touches[0].clientY
            )
            if (videoEl && videoEl.tagName === 'VIDEO') {
                touchActive = true
                touchStartY = e.touches[0].clientY
            } else {
                touchActive = false
            }
        }

        function handleTouchEnd(e) {
            if (!touchActive) return
            const deltaY = e.changedTouches[0].clientY - touchStartY
            if (Math.abs(deltaY) > 50) {
                if (deltaY < 0) nextVideo()
                else prevVideo()
            }
            touchActive = false
        }

        function pauseAllVideos() {
            const videos = document.querySelectorAll('video')
            videos.forEach((video, index) => {
                if (index !== activeVideoIndex.value) {
                    video.pause()
                    video.muted = true
                }
            })
        }

        function playActiveVideo() {
            const videos = document.querySelectorAll('video')
            if (videos[activeVideoIndex.value]) {
                const activeVideo = videos[activeVideoIndex.value]

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
                        updateVideoClass(activeVideo)
                        activeVideo.setAttribute('data-class-updated', 'true')
                    }
                    if (activeVideo.readyState >= 1) {
                        updateVideoClass(activeVideo)
                        activeVideo.setAttribute('data-class-updated', 'true')
                    }
                }
            }
        }

        function onVideoLoaded(index) {
            videoLoadStates.value[index] = true
        }

        function onVideoReady(index) {
            // Video is ready to play
            videoLoadStates.value[index] = true

            // Only auto-play if this is the active video and it's not already playing
            if (index === activeVideoIndex.value) {
                const videos = document.querySelectorAll('video')
                const video = videos[index]
                if (video && video.paused && !video.muted) {
                    setTimeout(() => {
                        video.play().catch(e => console.log('Auto-play failed:', e))
                    }, 100)
                }
            }
        }

        function autoPlayVideo() {
            // Only play if video is not already playing
            const videos = document.querySelectorAll('video')
            const activeVideo = videos[activeVideoIndex.value]
            if (activeVideo && activeVideo.paused) {
                setTimeout(() => {
                    playActiveVideo()
                }, 300)
            }
        }

        async function updateScoreHandler(newScore) {
            if (!currentVideo.value.id) return;
            await updateScore(currentVideo.value.id, newScore)
            currentVideo.value.score = newScore
        }

        const searchTimeMsg = ref('')

        async function doSearch() {
            const start = performance.now()
            state.searchKeyword = searchKeyword.value.trim()
            state.searchScore = searchScore.value
            state.page = 1
            currentIndex.value = 0
            showSearch.value = false
            await loadVideos(false)
            const ms = performance.now() - start
            searchTimeMsg.value = '搜索完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒'
            setTimeout(() => {
                searchTimeMsg.value = ''
            }, 3000)
        }

        async function likeVideo(newScore = 5) {
            if (!currentVideo.value.id) return;
            await updateScore(currentVideo.value.id, newScore);
            currentVideo.value.score = newScore;
        }

        async function fetchPaths() {
            const resp = await axios.get('/video-paths')
            pathList.value = resp.data.paths || []
        }

        async function addPath() {
            if (!newPath.value.trim()) return
            await axios.post('/video-paths', { path: newPath.value.trim() })
            newPath.value = ''
            fetchPaths()
        }

        async function indexPath(path) {
            const start = performance.now()
            await axios.post('/video-paths/index', { path })
            const ms = Math.round(performance.now() - start)
            alert('索引完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒')
        }
        async function indexPath_del(path) {
            const start = performance.now()
            await axios.post('/video-paths/index?del=1', { path })
            const ms = Math.round(performance.now() - start)
            alert('索引完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒')
        }

        // 也在视频切换后立即尝试更新
        onMounted(() => {
            initialLoad()
            fetchPaths()
            setTimeout(updateVideoClass, 1000)

            // 鼠标滚轮切换视频
            window.addEventListener('wheel', (e) => {
                if (e.deltaY > 0) nextVideo()
                else if (e.deltaY < 0) prevVideo()
            })
            function getCurrentlyPlayingVideo() {
                // 获取页面上所有的 <video> 元素
                const videos = document.querySelectorAll('video');

                // 遍历，找到第一个 paused 为 false 的（即正在播放的）
                for (const video of videos) {
                    if (!video.paused && !video.ended) {
                        return video; // 找到正在播放的，立即返回
                    }
                }

                return null; // 没有视频在播放
            }
            window.addEventListener('dblclick', (e) => {
                const videoElement = getCurrentlyPlayingVideo()

                if (!document.fullscreenElement) {
                    // 如果没有元素处于全屏状态，则请求 videoElement 进入全屏
                    if (videoElement.requestFullscreen) {
                        videoElement.requestFullscreen().catch(err => {
                            console.error(`进入全屏失败: ${err.message}`);
                        });
                    }
                }

            })

            // watch(() => videoQueue.value, () => {
            //     exitFullscreen()
            // })

            // 键盘上下方向键切换视频
            window.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') nextVideo()
                else if (e.key === 'ArrowUp') prevVideo()
            })
        })

        return {
            state,
            currentIndex,
            currentVideo,
            showDetail,
            getVideoUrl,
            prevVideo,
            nextVideo,
            toggleDetail,
            handleTouchStart,
            handleTouchEnd,
            updateScore: updateScoreHandler,
            showSearch,
            searchKeyword,
            searchScore,
            doSearch,
            likeVideo, // 新增
            showConfig,
            newPath,
            pathList,
            addPath,
            indexPath,
            indexPath_del,
            searchTimeMsg,
            videoClass,
            // 3-video preloading system
            videoQueue,
            activeVideoIndex,
            onVideoLoaded,
            onVideoReady,
            isLoading,
        }
    }
}).use(vant).mount('#app')

