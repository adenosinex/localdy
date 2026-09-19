import { fetchLatestVideos, getVideoUrl } from './api_base.js'
import { updateScore } from './api_modify.js'
import { searchVideos } from './api_search.js'
import { VideoPlayer } from './video-player.js'
import { SearchManager } from './search.js'
import { ConfigManager } from './config.js'
import { UrlParamsManager } from './url-params.js'

const { createApp, reactive, onMounted, computed, ref, watch } = Vue

// URL 中保存视频序号的参数名
const URL_VIDEO_KEY = 'v'

/**
 * 获取筛选条件下的视频总数（绝对总数）
 */
async function getTotalCount(pageSize, searchKeyword = '', searchScore = 0, searchSize = 0) {
    const params = []
    if (searchKeyword) params.push(`search=${encodeURIComponent(searchKeyword)}`)
    if (searchScore && searchScore > 0) params.push(`score=${searchScore}`)
    if (searchSize && searchSize > 0) params.push(`size=${searchSize}`)
    const url = `/videos/count${params.length ? '?' + params.join('&') : ''}`
    const resp = await axios.get(url)
    return resp.data.total || 0
}

/**
 * 按当前筛选条件算总页数（供随机页使用）
 */
async function getTotalPages(pageSize, searchKeyword = '', searchScore = 0, searchSize = 0) {
    const total = await getTotalCount(pageSize, searchKeyword, searchScore, searchSize)
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
            searchSize: 0,
            totalVideos: 0,   // 服务端全量绝对总数
            startPage: 1      // 本批视频对应的起始页码
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

        // 跳转输入框
        const jumpIndex = ref('')

        // 点赞交互状态
        const likeLoading = ref(0)   // 0=空闲；1/5=正在提交该分值
        const burstScore  = ref(0)   // 触发弹跳+粒子动画的分值
        const shakeScore  = ref(0)   // 触发失败抖动的分值

        // 3-video preloading system
        const videoQueue = ref([])
        const activeVideoIndex = ref(1)
        const videoLoadStates = ref([false, false, false])
        const isLoading = ref(true)
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

        // ===== 序号 / 总数 / 带序号标题 =====

        // 当前视频在本批已加载列表中的位置（从 1 开始）——保留给模板备用
        const currentVideoIndex = computed(() => {
            const id = currentVideo.value?.id
            if (id !== undefined && id !== null) {
                const idx = state.videos.findIndex(v => v.id === id)
                if (idx !== -1) return idx + 1
            }
            return Math.min(currentIndex.value + 1, state.videos.length || 1)
        })

        // 展示用总数：始终以服务端筛选后的绝对总数为基准
        const totalVideos = computed(() => state.totalVideos || 0)

        // 当前视频在搜索结果中的序号（从 1 开始，覆盖整个搜索结果集）
        const globalVideoIndex = computed(() => {
            if (!currentVideo.value?.id) return 0
            return (state.startPage - 1) * state.pageSize + currentIndex.value + 1
        })

        // 标题前缀，如 "[3/1250] "
        const videoIndexLabel = computed(() => {
            if (!currentVideo.value?.id || !globalVideoIndex.value) return ''
            // 总数未就绪时只显示序号，避免出现 [3/0]
            if (!totalVideos.value) return `[${globalVideoIndex.value}] `
            return `[${globalVideoIndex.value}/${totalVideos.value}] `
        })

        // 带序号的完整标题
        const currentVideoTitle = computed(() => {
            const title = currentVideo.value?.title || ''
            if (!currentVideo.value?.id) return title
            return `${videoIndexLabel.value}${title}`
        })

        // ===== 总数刷新 =====

        /**
         * 按当前 state 中的筛选条件刷新绝对总数
         */
        async function refreshTotalCount() {
            try {
                const total = await getTotalCount(
                    state.pageSize,
                    state.searchKeyword,
                    state.searchScore,
                    state.searchSize
                )
                state.totalVideos = total
            } catch (e) {
                console.error('获取总数失败:', e)
                state.totalVideos = 0
            }
        }

        // ===== URL 同步 =====

        // 把当前全局序号写入 URL（replaceState，不增加历史记录）
        function updateUrlWithIndex() {
            const idx = globalVideoIndex.value
            if (!idx || idx < 1) return
            try {
                const url = new URL(window.location.href)
                if (url.searchParams.get(URL_VIDEO_KEY) === String(idx)) return
                url.searchParams.set(URL_VIDEO_KEY, String(idx))
                window.history.replaceState(window.history.state, '', url.toString())
            } catch (e) {
                // 忽略 URL 更新失败
            }
        }

        // 从 URL 读取视频序号
        function readIndexFromUrl() {
            try {
                const params = new URLSearchParams(window.location.search)
                const v = parseInt(params.get(URL_VIDEO_KEY), 10)
                if (Number.isFinite(v) && v > 0) return v
            } catch (e) {}
            return null
        }

        // ===== 跳转到指定全局序号 =====

        async function jumpToIndex(v, skipUrl = false) {
            if (!v || v < 1) return false
            // 序号不能超过绝对总数
            if (state.totalVideos && v > state.totalVideos) {
                v = state.totalVideos
            }

            const page = Math.ceil(v / state.pageSize)
            const localIdx = (v - 1) % state.pageSize

            state.page = page
            state.startPage = page

            await loadVideos(false)

            // 定位到该页内的目标视频
            const maxIdx = Math.max(0, state.videos.length - 1)
            currentIndex.value = Math.min(localIdx, maxIdx)

            // 因为 loadVideos 内部已用 currentIndex=0 初始化过队列，
            // 这里改过 currentIndex 后需要重建播放队列
            videoPlayer.initializeVideoQueue()

            if (!skipUrl) {
                setTimeout(() => updateUrlWithIndex(), 0)
            }
            return true
        }

        // 跳转按钮的处理
        async function doJump() {
            const v = parseInt(jumpIndex.value, 10)
            if (!Number.isFinite(v) || v < 1) return
            await jumpToIndex(v)
            jumpIndex.value = ''
        }

        // 监听当前视频变化，把序号写入 URL
        watch(
            () => [currentVideo.value?.id, state.startPage],
            ([id]) => {
                if (id) updateUrlWithIndex()
            }
        )

        // 浏览器前进/后退时，读取 URL 中的序号并跳转
        window.addEventListener('popstate', () => {
            const v = readIndexFromUrl()
            if (v && v !== globalVideoIndex.value) {
                jumpToIndex(v, true)
            }
        })

        // ===== 数据加载 =====

        async function loadVideos(append = false) {
            const newVideos = await fetchLatestVideos(state)
            if (append) {
                state.videos.push(...newVideos)
            } else {
                state.videos = newVideos
                currentIndex.value = 0
            }
            videoPlayer.initializeVideoQueue()
        }

        videoPlayer.setLoadMoreVideos(async () => {
            await loadVideos(true)
        })

        // 搜索管理器：每次搜索前先刷新总数
        searchManager.setLoadVideosCallback(async (append = false) => {
            await refreshTotalCount()
            await loadVideos(append)
        })

        async function initialLoad() {
            try {
                isLoading.value = true

                // 1. 加载搜索条件（可能来自 URL）
                searchManager.loadFromUrlParams()

                // 2. 先拿到筛选条件下的绝对总数
                await refreshTotalCount()

                // 3. 检查 URL 中的视频序号
                const urlIndex = readIndexFromUrl()

                if (urlIndex) {
                    // URL 指定了视频序号 → 直接定位
                    await jumpToIndex(urlIndex, true)
                } else {
                    // 没有指定 → 随机挑一页
                    const totalPages = Math.max(1, Math.ceil(state.totalVideos / state.pageSize))
                    state.page = Math.floor(Math.random() * totalPages) + 1
                    state.startPage = state.page
                    await loadVideos(false)
                }

                showSearch.value = false
                showConfig.value = false

                setTimeout(() => {
                    isLoading.value = false
                    setTimeout(() => {
                        videoPlayer.playActiveVideo()
                    }, 500)
                }, 1500)
            } catch (error) {
                console.error('Initial load failed:', error)
                isLoading.value = false
            }
        }

        // ===== 播放控制 =====
        const prevVideo = () => videoPlayer.prevVideo()
        const nextVideo = () => videoPlayer.nextVideo()

        function toggleDetail() {
            showDetail.value = !showDetail.value
        }

        const handleTouchStart = (e) => videoPlayer.handleTouchStart(e)
        const handleTouchEnd = (e) => videoPlayer.handleTouchEnd(e)
        const onVideoLoaded = (index) => videoPlayer.onVideoLoaded(index)
        const onVideoReady = (index) => videoPlayer.onVideoReady(index)

        // ===== 点赞 / 评分 =====

        /**
         * 统一的评分提交逻辑：负责 loading、成功/失败动效、回滚
         */
        async function submitScore(newScore) {
            if (!currentVideo.value?.id) return
            // 正在提交中，忽略重复点击
            if (likeLoading.value) return

            const prevScore = currentVideo.value.score
            likeLoading.value = newScore

            try {
                await updateScore(currentVideo.value.id, newScore)
                currentVideo.value.score = newScore

                // 成功：弹跳 + 粒子
                burstScore.value = newScore
                setTimeout(() => {
                    if (burstScore.value === newScore) burstScore.value = 0
                }, 700)
            } catch (err) {
                console.error('评分提交失败:', err)
                // 失败：回滚分数 + 抖动
                currentVideo.value.score = prevScore
                shakeScore.value = newScore
                setTimeout(() => {
                    if (shakeScore.value === newScore) shakeScore.value = 0
                }, 500)
            } finally {
                likeLoading.value = 0
            }
        }

        // 对外暴露
        const likeVideo = (newScore = 5) => submitScore(newScore)
        const updateScoreHandler = (newScore) => submitScore(newScore)

        const doSearch = () => searchManager.doSearch()

        // ===== 配置管理 =====
        const fetchPaths = () => configManager.fetchPaths()
        const addPath = () => configManager.addPath()
        const indexPath = (path) => configManager.indexPath(path)
        const indexPath_del = (path) => configManager.indexPath_del(path)

        // ===== 大小过滤 =====
        const setQuickSize = (operator, size) => {
            sizeOperator.value = operator
            sizeValue.value = size
            updateSizeFilter()
        }

        const clearSizeFilter = () => {
            sizeOperator.value = 'lte'
            sizeValue.value = ''
            state.searchSize = 0
        }

        const updateSizeFilter = () => {
            if (sizeValue.value && sizeValue.value > 0) {
                state.searchSize = `${sizeOperator.value}:${sizeValue.value}`
            } else {
                state.searchSize = 0
            }
        }

        onMounted(() => {
            initialLoad()
            fetchPaths()
            videoPlayer.initEventListeners()
            searchManager.initPopstateListener()
            setTimeout(() => videoPlayer.updateVideoClass(), 1000)
        })

        return {
            state,
            currentIndex,
            currentVideo,
            // 序号相关
            currentVideoIndex,
            globalVideoIndex,
            totalVideos,
            videoIndexLabel,
            currentVideoTitle,
            // 跳转相关
            jumpIndex,
            doJump,
            jumpToIndex,
            // 总数刷新
            refreshTotalCount,
            // 点赞交互状态
            likeLoading,
            burstScore,
            shakeScore,
            // 其他
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
            videoQueue,
            activeVideoIndex,
            onVideoLoaded,
            onVideoReady,
            isLoading,
        }
    }
}).use(vant).mount('#app')