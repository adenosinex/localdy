// 搜索相关
export async function searchVideos({ keyword = '', score = 0, size = 0, page = 1 }) {
    const params = { page }
    if (keyword) params.search = keyword
    if (score) params.score = score
    if (size) params.size = size
    const res = await axios.get('/videos', { params })
    return res.data
}