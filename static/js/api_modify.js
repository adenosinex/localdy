// 信息修改相关
export async function updateScore(videoId, score) {
    await axios.post('/videos/update_score', {
        id: videoId,
        score: score  
    })
}