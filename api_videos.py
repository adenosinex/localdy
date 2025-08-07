from flask import Blueprint, request, jsonify, Response, stream_with_context, send_file, abort
from models import Video, extract_tags, Session
import os

bp_videos = Blueprint('videos', __name__)

@bp_videos.route('/videos', methods=['GET'])
def get_videos():
    """
    获取视频列表，支持分页、分数筛选、标签筛选、关键词搜索。
    支持流式响应（stream=true）。
    """
    session = Session()
    query = session.query(Video)
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 10))
    score = request.args.get('score')
    tags = request.args.get('tags')
    search = request.args.get('search')
    latest = request.args.get('latest')
    stream = request.args.get('stream', 'false').lower() == 'true'

    if score:
        query = query.filter(Video.score == int(score))
    if tags:
        for tag in tags.split(','):
            query = query.filter(Video.tags.like(f"%{tag}%"))
    if search:
        query = query.filter(
            (Video.filename.like(f"%{search}%")) | (Video.detail.like(f"%{search}%"))
        )
    query = query.order_by(Video.id.desc())
    if latest:
        query = query.limit(int(latest))
    else:
        query = query.offset((page-1)*page_size).limit(page_size)
    videos = query.all()
    session.close()

    def generate():
        yield '['
        for i, v in enumerate(videos):
            item = (
                f'{{"id":{v.id},"filename":"{v.filename}","tags":"{v.tags}",'
                f'"score":{v.score},"detail":"{v.detail}"}}'
            )
            if i > 0:
                yield ','
            yield item
        yield ']'

    if stream:
        return Response(stream_with_context(generate()), mimetype='application/json')
    else:
        return jsonify([
            {
                "id": v.id,
                "filename": v.filename,
                "tags": v.tags,
                "score": v.score,
                "detail": v.detail
            } for v in videos
        ])

@bp_videos.route('/videos/<int:video_id>', methods=['GET'])
def get_video_detail(video_id):
    """
    获取指定视频详情。
    """
    session = Session()
    video = session.query(Video).filter(Video.id == video_id).first()
    session.close()
    if video:
        return jsonify({
            "id": video.id,
            "filename": video.filename,
            "tags": video.tags,
            "score": video.score,
            "detail": video.detail
        })
    return jsonify({"error": "视频不存在"}), 404

@bp_videos.route('/videos/<int:video_id>/stream', methods=['GET'])
def stream_video_file(video_id):
    """
    根据视频id返回视频流，前端可跳转播放。
    detail字段为文件夹名，filename为文件名。
    """
    session = Session()
    video = session.query(Video).filter(Video.id == video_id).first()
    session.close()
    if not video:
        return abort(404, "视频不存在")
    # 假设视频根目录为 videos 文件夹
     
    video_path =  video.detail 
    if not os.path.isfile(video_path):
        return abort(404, "视频文件不存在")
    # 以流式方式响应视频文件
    return send_file(video_path, mimetype='video/mp4', as_attachment=True)
