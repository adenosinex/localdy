// 基础信息获取相关
export async function fetchLatestVideos(state) {
    const res = await axios.get('/videos', {
        params: { latest: state.pageSize,page:state.page, page_size: state.pageSize, search : state.searchKeyword,score:state.searchScore }
    })
    return res.data
}

export function getVideoUrl(id) {
    return `/videos/${id}/stream`
}