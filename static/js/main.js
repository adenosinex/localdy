import { fetchLatestVideos, getVideoUrl } from './api_base.js'
import { updateScore } from './api_modify.js'
import { searchVideos } from './api_search.js'

const { createApp, reactive, onMounted, computed, ref } = Vue

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

        const currentVideo = computed(() => state.videos[currentIndex.value] || {})

        async function loadVideos(append = false) {
            const newVideos = await fetchLatestVideos(state )
            if (append) {
                state.videos.push(...newVideos)
            } else {
                state.videos = newVideos
                currentIndex.value = 0
            }
        }

        async function initialLoad() {
            // 获取总页数，随机选择一个页码
            const totalPages = await getTotalPages(state.pageSize)
            state.page = Math.floor(Math.random() * totalPages) + 1
            await loadVideos(false)
        }

        function prevVideo() {
            if (currentIndex.value > 0) {
                currentIndex.value--
                autoPlayVideo()
            } 
        }

        async function nextVideo() {
            if (currentIndex.value < state.videos.length - 1) {
                currentIndex.value++
                autoPlayVideo()
            } else {
                // 已到最后一个，自动加载下一页
                state.page++
                await loadVideos(true)
                if (state.videos.length > currentIndex.value + 1) {
                    currentIndex.value++
                    autoPlayVideo()
                }
            }
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

        function autoPlayVideo() {
            setTimeout(() => {
                const videoEl = document.querySelector('video')
                if (videoEl) videoEl.play()
            }, 800)
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

        async function likeVideo(newScore=5) {
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
            alert('索引完成，用时 ' +  (ms / 1000).toFixed(2) + ' 秒')
        }
        async function indexPath_del(path) {
            const start = performance.now()
            await axios.post('/video-paths/index?del=1', { path })
            const ms = Math.round(performance.now() - start)
            alert('索引完成，用时 ' +  (ms / 1000).toFixed(2) + ' 秒')
        }

        onMounted(() => {
            initialLoad()
            fetchPaths()

            // 鼠标滚轮切换视频
            window.addEventListener('wheel', (e) => {
                if (e.deltaY > 0) nextVideo()
                else if (e.deltaY < 0) prevVideo()
            })

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
        }
    }
    }).use(vant).mount('#app')

