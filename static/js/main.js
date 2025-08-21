import { fetchLatestVideos, getVideoUrl } from './api_base.js'
import { updateScore } from './api_modify.js'
import { searchVideos } from './api_search.js'
import { VideoPlayer } from './video-player.js'
import { SearchManager } from './search.js'
import { ConfigManager } from './config.js'
import { UrlParamsManager } from './url-params.js'

const { createApp, reactive, onMounted, computed, ref, watch } = Vue

async function getTotalPages(pageSize, searchKeyword = '', searchScore = 0, searchSize = 0) {
    // 获取总视频数
    const params = []
    if (searchKeyword) params.push(`search=${encodeURIComponent(searchKeyword)}`)
    if (searchScore && searchScore > 0) params.push(`score=${searchScore}`)
    if (searchSize && searchSize > 0) params.push(`size=${searchSize}`)
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
            searchKeyword: '',
            searchScore: 0,
            searchSize: 0
        })
        const currentIndex = ref(0)
        const showDetail = ref(false)
        const showSearch = ref(false)
        const showConfig = ref(false)
        const searchKeyword = ref('')
        const searchScore = ref(0)
        const searchSize = ref(0)
        const sizeOperator = ref('lte')
        const sizeValue = ref('')
        const newPath = ref('')
        const pathList = ref([])
        const searchTimeMsg = ref('')

        // 3-video preloading system
        const videoQueue = ref([])
        const activeVideoIndex = ref(1) // Middle video is active
        const videoLoadStates = ref([false, false, false])
        const isLoading = ref(true) // Loading state for initial UI
        const videoClass = ref('video-portrait')

        // 初始化管理器
        const urlParamsManager = new UrlParamsManager()
        const refs = {
            currentIndex,
            videoQueue,
            activeVideoIndex,
            videoLoadStates,
            videoClass,
            showSearch,
            searchKeyword,
            searchScore,
            searchSize,
            sizeOperator,
            sizeValue,
            searchTimeMsg,
            newPath,
            pathList
        }
        
        const videoPlayer = new VideoPlayer(state, refs)
        const searchManager = new SearchManager(state, refs)
        const configManager = new ConfigManager(refs)

        const currentVideo = computed(() => {
            if (videoQueue.value.length > 0 && activeVideoIndex.value < videoQueue.value.length) {
                return videoQueue.value[activeVideoIndex.value] || {}
            }
            return state.videos[currentIndex.value] || {}
        })

        async function loadVideos(append = false) {
            const newVideos = await fetchLatestVideos(state)
            if (append) {
                state.videos.push(...newVideos)
            } else {
                state.videos = newVideos
                currentIndex.value = 0
            }
            // Initialize video queue after loading videos
            videoPlayer.initializeVideoQueue()
        }

        // 设置视频播放器的加载更多视频回调
        videoPlayer.setLoadMoreVideos(async () => {
            await loadVideos(true)
        })

        // 设置搜索管理器的加载视频回调
        searchManager.setLoadVideosCallback(loadVideos)

        async function initialLoad() {
            try {
                isLoading.value = true
                
                // 检查URL参数中是否有搜索条件
                const hasUrlSearch = searchManager.loadFromUrlParams()

                if (!hasUrlSearch || true) {
                    // 获取总页数，随机选择一个页码
                    const totalPages = await getTotalPages(state.pageSize, state.searchKeyword, state.searchScore, state.searchSize)
                    state.page = Math.floor(Math.random() * totalPages) + 1
                    // const random_index = Math.floor(Math.random() * state.pageSize)
                    // for(let i = 0; i < random_index; i++) {
                    //     nextVideo()
                    // }
                }
                
                await loadVideos(false)
                showSearch.value = false // 首屏不显示搜索弹窗
                showConfig.value = false // 首屏不显示配置弹窗

                // Wait a bit for videos to initialize, then hide loading
                setTimeout(() => {
                    isLoading.value = false
                    // Start playing the first video after loading is complete
                    setTimeout(() => {
                        videoPlayer.playActiveVideo()
                    }, 500)
                }, 1500)
            } catch (error) {
                console.error('Initial load failed:', error)
                isLoading.value = false
            }
        }

        // 使用视频播放器的方法
        const prevVideo = () => videoPlayer.prevVideo()
        const nextVideo = () => videoPlayer.nextVideo()

        function toggleDetail() {
            showDetail.value = !showDetail.value
        }

        // 使用视频播放器的方法
        const handleTouchStart = (e) => videoPlayer.handleTouchStart(e)
        const handleTouchEnd = (e) => videoPlayer.handleTouchEnd(e)
        const onVideoLoaded = (index) => videoPlayer.onVideoLoaded(index)
        const onVideoReady = (index) => videoPlayer.onVideoReady(index)

        async function updateScoreHandler(newScore) {
            if (!currentVideo.value.id) return;
            await updateScore(currentVideo.value.id, newScore)
            currentVideo.value.score = newScore
        }

        // 使用搜索管理器的doSearch方法
        const doSearch = () => searchManager.doSearch()

        async function likeVideo(newScore = 5) {
            if (!currentVideo.value.id) return;
            await updateScore(currentVideo.value.id, newScore);
            currentVideo.value.score = newScore;
        }

        // 使用配置管理器的方法
        const fetchPaths = () => configManager.fetchPaths()
        const addPath = () => configManager.addPath()
        const indexPath = (path) => configManager.indexPath(path)
        const indexPath_del = (path) => configManager.indexPath_del(path)

        // 大小过滤相关方法
        const setQuickSize = (operator, size) => {
            sizeOperator.value = operator
            sizeValue.value = size
            // 自动更新搜索状态
            updateSizeFilter()
        }

        const clearSizeFilter = () => {
            sizeOperator.value = 'lte'
            sizeValue.value = ''
            state.searchSize = 0
        }

        const updateSizeFilter = () => {
            if (sizeValue.value && sizeValue.value > 0) {
                // 构建大小过滤字符串: operator:value (例如: "lte:100", "gte:500")
                state.searchSize = `${sizeOperator.value}:${sizeValue.value}`
            } else {
                state.searchSize = 0
            }
        }

        onMounted(() => {
            initialLoad()
            fetchPaths()
            
            // 初始化视频播放器事件监听器
            videoPlayer.initEventListeners()
            
            // 初始化搜索管理器的URL监听
            searchManager.initPopstateListener()
            
            setTimeout(() => videoPlayer.updateVideoClass(), 1000)
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
            searchSize,
            sizeOperator,
            sizeValue,
            setQuickSize,
            clearSizeFilter,
            updateSizeFilter,
            doSearch,
            likeVideo,
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

