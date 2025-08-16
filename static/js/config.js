// 配置管理模块
export class ConfigManager {
    constructor(refs) {
        this.refs = refs
    }

    // 获取视频路径列表
    async fetchPaths() {
        const resp = await axios.get('/video-paths')
        this.refs.pathList.value = resp.data.paths || []
    }

    // 添加新路径
    async addPath() {
        if (!this.refs.newPath.value.trim()) return
        await axios.post('/video-paths', { path: this.refs.newPath.value.trim() })
        this.refs.newPath.value = ''
        this.fetchPaths()
    }

    // 索引路径
    async indexPath(path) {
        const start = performance.now()
        await axios.post('/video-paths/index', { path })
        const ms = Math.round(performance.now() - start)
        alert('索引完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒')
    }

    // 删除索引路径
    async indexPath_del(path) {
        const start = performance.now()
        await axios.post('/video-paths/index?del=1', { path })
        const ms = Math.round(performance.now() - start)
        alert('索引完成，用时 ' + (ms / 1000).toFixed(2) + ' 秒')
    }

    // 删除路径
    async deletePath(path) {
        if (!confirm(`确定要删除路径 "${path}" 吗？`)) return
        try {
            await axios.delete('/video-paths', { data: { path } })
            this.fetchPaths()
        } catch (error) {
            console.error('删除路径失败:', error)
            alert('删除路径失败')
        }
    }

    // 获取系统配置
    async getSystemConfig() {
        try {
            const resp = await axios.get('/config')
            return resp.data
        } catch (error) {
            console.error('获取系统配置失败:', error)
            return {}
        }
    }

    // 更新系统配置
    async updateSystemConfig(config) {
        try {
            await axios.post('/config', config)
            return true
        } catch (error) {
            console.error('更新系统配置失败:', error)
            return false
        }
    }

    // 获取用户偏好设置
    getUserPreferences() {
        try {
            return JSON.parse(localStorage.getItem('userPreferences') || '{}')
        } catch {
            return {}
        }
    }

    // 保存用户偏好设置
    saveUserPreferences(preferences) {
        localStorage.setItem('userPreferences', JSON.stringify(preferences))
    }

    // 重置用户偏好设置
    resetUserPreferences() {
        localStorage.removeItem('userPreferences')
    }

    // 导出配置
    exportConfig() {
        const config = {
            userPreferences: this.getUserPreferences(),
            searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
            timestamp: new Date().toISOString()
        }
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `localdy-config-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // 导入配置
    async importConfig(file) {
        try {
            const text = await file.text()
            const config = JSON.parse(text)
            
            if (config.userPreferences) {
                this.saveUserPreferences(config.userPreferences)
            }
            
            if (config.searchHistory) {
                localStorage.setItem('searchHistory', JSON.stringify(config.searchHistory))
            }
            
            return true
        } catch (error) {
            console.error('导入配置失败:', error)
            return false
        }
    }
}
