// 基础信息获取相关
export async function fetchLatestVideos(page = 1, pageSize = 5,keyword='') {
    const res = await axios.get('/videos', {
        params: { latest: pageSize, page, page_size: pageSize, search : keyword }
    })
    return res.data
}

export function getVideoUrl(id) {
    return `/videos/${id}/stream`
}