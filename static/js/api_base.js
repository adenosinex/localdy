// 基础信息获取相关
export async function fetchLatestVideos(state) {
    const params = { 
        latest: state.pageSize,
        page: state.page, 
        page_size: state.pageSize, 
        search: state.searchKeyword,
        score: state.searchScore
    }
    
    // 添加大小过滤参数
    if (state.searchSize && state.searchSize !== 0) {
        params.size = state.searchSize
    }
    
    const res = await axios.get('/videos', { params })
    return res.data
}

export function getVideoUrl(id) {
    return `/videos/${id}/stream`
}