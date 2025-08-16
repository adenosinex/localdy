// URL参数处理模块
export class UrlParamsManager {
    constructor() {
        this.params = new URLSearchParams(window.location.search)
    }

    // 获取URL参数
    getParam(key) {
        return this.params.get(key)
    }

    // 设置URL参数
    setParam(key, value) {
        if (value === null || value === undefined || value === '') {
            this.params.delete(key)
        } else {
            this.params.set(key, value)
        }
        this.updateUrl()
    }

    // 删除URL参数
    deleteParam(key) {
        this.params.delete(key)
        this.updateUrl()
    }

    // 批量设置参数
    setParams(paramsObj) {
        Object.entries(paramsObj).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                this.params.delete(key)
            } else {
                this.params.set(key, value)
            }
        })
        this.updateUrl()
    }

    // 获取所有参数
    getAllParams() {
        const result = {}
        for (const [key, value] of this.params) {
            result[key] = value
        }
        return result
    }

    // 清除所有参数
    clearAllParams() {
        this.params = new URLSearchParams()
        this.updateUrl()
    }

    // 更新浏览器URL
    updateUrl() {
        const url = new URL(window.location)
        url.search = this.params.toString()
        window.history.pushState({}, '', url)
    }

    // 检查是否有特定参数
    hasParam(key) {
        return this.params.has(key)
    }

    // 获取数字类型参数
    getNumberParam(key, defaultValue = 0) {
        const value = this.params.get(key)
        if (value === null) return defaultValue
        const num = parseInt(value)
        return isNaN(num) ? defaultValue : num
    }

    // 获取布尔类型参数
    getBooleanParam(key, defaultValue = false) {
        const value = this.params.get(key)
        if (value === null) return defaultValue
        return value === 'true' || value === '1'
    }

    // 获取数组类型参数（逗号分隔）
    getArrayParam(key, defaultValue = []) {
        const value = this.params.get(key)
        if (value === null) return defaultValue
        return value.split(',').filter(item => item.trim())
    }

    // 设置数组类型参数
    setArrayParam(key, array) {
        if (!Array.isArray(array) || array.length === 0) {
            this.params.delete(key)
        } else {
            this.params.set(key, array.join(','))
        }
        this.updateUrl()
    }

    // 监听URL变化（浏览器前进后退）
    onUrlChange(callback) {
        window.addEventListener('popstate', () => {
            this.params = new URLSearchParams(window.location.search)
            callback(this.getAllParams())
        })
    }

    // 生成分享链接
    generateShareUrl(additionalParams = {}) {
        const url = new URL(window.location.origin + window.location.pathname)
        const allParams = { ...this.getAllParams(), ...additionalParams }
        
        Object.entries(allParams).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, value)
            }
        })
        
        return url.toString()
    }

    // 从对象恢复URL参数
    restoreFromObject(paramsObj) {
        this.params = new URLSearchParams()
        Object.entries(paramsObj).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                this.params.set(key, value)
            }
        })
        this.updateUrl()
    }

    // 获取完整的URL状态（用于保存/恢复）
    getUrlState() {
        return {
            pathname: window.location.pathname,
            search: this.params.toString(),
            params: this.getAllParams()
        }
    }

    // 恢复URL状态
    restoreUrlState(state) {
        if (state.params) {
            this.restoreFromObject(state.params)
        } else if (state.search) {
            this.params = new URLSearchParams(state.search)
            this.updateUrl()
        }
    }
}
