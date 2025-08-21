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
        // 更新大小过滤状态
        if (this.refs.sizeValue.value && this.refs.sizeValue.value > 0) {
            this.state.searchSize = `${this.refs.sizeOperator.value}:${this.refs.sizeValue.value}`
        } else {
            this.state.searchSize = 0
        }
        this.state.page = 1
        this.refs.currentIndex.value = 0
        this.refs.showSearch.value = false
        
        // 更新URL参数
        this.updateUrlParams()
        
        // 显示搜索提示
        this.showSearchHint()
        
        await this.loadVideosCallback(false)
        const ms = performance.now() - start
        this.refs.searchTimeMsg.value = '搜索完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒'
        setTimeout(() => {
            this.refs.searchTimeMsg.value = ''
        }, 3000)
    }

    // 显示搜索提示并自动应用
    showSearchHint() {
        const conditions = []
        if (this.state.searchKeyword) {
            conditions.push(`关键词: "${this.state.searchKeyword}"`)
        }
        if (this.state.searchScore > 0) {
            conditions.push(`评分: ${this.state.searchScore}分`)
        }
        if (this.state.searchSize && this.state.searchSize !== 0) {
            const [operator, value] = this.state.searchSize.split(':')
            const operatorText = operator === 'lte' ? '≤' : operator === 'gte' ? '≥' : '='
            conditions.push(`大小: ${operatorText}${value}MB`)
        }
        
        if (conditions.length > 0) {
            this.refs.searchTimeMsg.value = `应用筛选条件: ${conditions.join(', ')}`
        }
    }

    // 自动应用搜索配置
    async autoApplySearch() {
        // 检查是否有搜索条件变化
        const hasChanges = this.hasSearchChanges()
        if (hasChanges) {
            this.refs.searchTimeMsg.value = '检测到搜索条件变化，正在自动应用...'
            await this.doSearch()
        }
    }

    // 检查搜索条件是否有变化
    hasSearchChanges() {
        const currentKeyword = this.refs.searchKeyword.value.trim()
        const currentScore = this.refs.searchScore.value
        const currentSize = this.refs.sizeValue.value && this.refs.sizeValue.value > 0 
            ? `${this.refs.sizeOperator.value}:${this.refs.sizeValue.value}` : 0

        return currentKeyword !== this.state.searchKeyword ||
               currentScore !== this.state.searchScore ||
               currentSize !== this.state.searchSize
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
        
        if (this.state.searchSize && this.state.searchSize !== 0) {
            url.searchParams.set('size', this.state.searchSize)
        } else {
            url.searchParams.delete('size')
        }
        
        // 更新浏览器历史记录，但不刷新页面
        window.history.pushState({}, '', url)
    }

    // 从URL参数加载搜索条件
    loadFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search)
        
        const searchParam = urlParams.get('search')
        const scoreParam = urlParams.get('score')
        const sizeParam = urlParams.get('size')
        
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
        
        if (sizeParam) {
            if (sizeParam.includes(':')) {
                // 新格式: "operator:value" (例如: "lte:100", "gte:500")
                const [operator, value] = sizeParam.split(':')
                const sizeValue = parseInt(value)
                if (!isNaN(sizeValue) && sizeValue > 0) {
                    this.refs.sizeOperator.value = operator
                    this.refs.sizeValue.value = sizeValue
                    this.state.searchSize = sizeParam
                }
            } else {
                // 兼容旧格式: 纯数字，默认为小于等于
                const size = parseInt(sizeParam)
                if (!isNaN(size) && size > 0) {
                    this.refs.sizeOperator.value = 'lte'
                    this.refs.sizeValue.value = size
                    this.state.searchSize = `lte:${size}`
                }
            }
        }
        
        // 如果有搜索参数，自动执行搜索
        if (searchParam || scoreParam || sizeParam) {
            return true // 表示需要执行搜索
        }
        
        return false
    }

    // 清除搜索条件
    clearSearch() {
        this.refs.searchKeyword.value = ''
        this.refs.searchScore.value = 0
        this.refs.sizeOperator.value = 'lte'
        this.refs.sizeValue.value = ''
        this.state.searchKeyword = ''
        this.state.searchScore = 0
        this.state.searchSize = 0
        this.state.page = 1
        this.refs.currentIndex.value = 0
        
        // 清除URL参数
        const url = new URL(window.location)
        url.searchParams.delete('search')
        url.searchParams.delete('score')
        url.searchParams.delete('size')
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
