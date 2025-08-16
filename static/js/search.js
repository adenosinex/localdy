// 搜索功能模块
import { searchVideos } from './api_search.js'

export class SearchManager {
    constructor(state, refs) {
        this.state = state
        this.refs = refs
    }

    // 执行搜索
    async doSearch() {
        const start = performance.now()
        this.state.searchKeyword = this.refs.searchKeyword.value.trim()
        this.state.searchScore = this.refs.searchScore.value
        this.state.page = 1
        this.refs.currentIndex.value = 0
        this.refs.showSearch.value = false
        
        // 更新URL参数
        this.updateUrlParams()
        
        await this.loadVideosCallback(false)
        const ms = performance.now() - start
        this.refs.searchTimeMsg.value = '搜索完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒'
        setTimeout(() => {
            this.refs.searchTimeMsg.value = ''
        }, 3000)
    }

    // 更新URL参数
    updateUrlParams() {
        const url = new URL(window.location)
        
        if (this.state.searchKeyword) {
            url.searchParams.set('search', this.state.searchKeyword)
        } else {
            url.searchParams.delete('search')
        }
        
        if (this.state.searchScore && this.state.searchScore > 0) {
            url.searchParams.set('score', this.state.searchScore)
        } else {
            url.searchParams.delete('score')
        }
        
        // 更新浏览器历史记录，但不刷新页面
        window.history.pushState({}, '', url)
    }

    // 从URL参数加载搜索条件
    loadFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search)
        
        const searchParam = urlParams.get('search')
        const scoreParam = urlParams.get('score')
        
        if (searchParam) {
            this.refs.searchKeyword.value = searchParam
            this.state.searchKeyword = searchParam
        }
        
        if (scoreParam) {
            const score = parseInt(scoreParam)
            if (!isNaN(score) && score > 0) {
                this.refs.searchScore.value = score
                this.state.searchScore = score
            }
        }
        
        // 如果有搜索参数，自动执行搜索
        if (searchParam || scoreParam) {
            return true // 表示需要执行搜索
        }
        
        return false
    }

    // 清除搜索条件
    clearSearch() {
        this.refs.searchKeyword.value = ''
        this.refs.searchScore.value = 0
        this.state.searchKeyword = ''
        this.state.searchScore = 0
        this.state.page = 1
        this.refs.currentIndex.value = 0
        
        // 清除URL参数
        const url = new URL(window.location)
        url.searchParams.delete('search')
        url.searchParams.delete('score')
        window.history.pushState({}, '', url)
    }

    // 设置加载视频的回调函数
    setLoadVideosCallback(callback) {
        this.loadVideosCallback = callback
    }

    // 监听浏览器前进后退按钮
    initPopstateListener() {
        window.addEventListener('popstate', () => {
            const shouldSearch = this.loadFromUrlParams()
            if (shouldSearch) {
                this.doSearch()
            } else {
                this.clearSearch()
                this.loadVideosCallback(false)
            }
        })
    }

    // 获取搜索建议（可扩展功能）
    async getSearchSuggestions(keyword) {
        // 这里可以实现搜索建议功能
        // 暂时返回空数组
        return []
    }

    // 保存搜索历史（可扩展功能）
    saveSearchHistory(keyword) {
        if (!keyword.trim()) return
        
        const history = this.getSearchHistory()
        const newHistory = [keyword, ...history.filter(item => item !== keyword)].slice(0, 10)
        localStorage.setItem('searchHistory', JSON.stringify(newHistory))
    }

    // 获取搜索历史
    getSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem('searchHistory') || '[]')
        } catch {
            return []
        }
    }

    // 清除搜索历史
    clearSearchHistory() {
        localStorage.removeItem('searchHistory')
    }
}
