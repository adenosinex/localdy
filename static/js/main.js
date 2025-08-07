import { fetchLatestVideos, getVideoUrl } from './api_base.js'
import { updateScore } from './api_modify.js'
import { searchVideos } from './api_search.js'

const { createApp, reactive, onMounted, computed, ref } = Vue

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
        const searchKeyword = ref('')
        const searchScore = ref(0)
        let touchStartY = 0
        let touchActive = false

        const currentVideo = computed(() => state.videos[currentIndex.value] || {})

        async function loadVideos(append = false) {
            const newVideos = await fetchLatestVideos(state.page, state.pageSize)
            if (append) {
                state.videos.push(...newVideos)
            } else {
                state.videos = newVideos
                currentIndex.value = 0
            }
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

        async function doSearch() {
            state.videos = await searchVideos({
                keyword: searchKeyword.value,
                score: searchScore.value,
                page: state.page
            })
            currentIndex.value = 0
            showSearch.value = false
        }

        async function likeVideo() {
            if (!currentVideo.value.id) return;
            await updateScore(currentVideo.value.id, 5);
            currentVideo.value.score = 5;
        }

        onMounted(() => {
            loadVideos()
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
            likeVideo // 新增
        }
    }
    }).use(vant).mount('#app')

