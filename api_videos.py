from flask import Blueprint, request, jsonify, Response, stream_with_context, send_file, abort
from models import Video, extract_tags, Session
import os
import json
from data_init import init_data_from_folder,del_videos_path
bp_videos = Blueprint('videos', __name__)

PATHS_FILE = 'video_paths.json'

def load_paths():
    if os.path.exists(PATHS_FILE):
        with open(PATHS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_paths(paths):
    with open(PATHS_FILE, 'w', encoding='utf-8') as f:
        json.dump(paths, f, ensure_ascii=False)

@bp_videos.route('/video-paths', methods=['GET'])
def get_video_paths():
    return jsonify({'paths': load_paths()})

@bp_videos.route('/video-paths', methods=['POST'])
def add_video_path():
    data = request.get_json()
    path = data.get('path', '').strip()
    if not path or not os.path.isdir(path):
        return jsonify({'error': '路径无效'}), 400
    paths = load_paths()
    if path not in paths:
        paths.append(path)
        save_paths(paths)
        init_data_from_folder(path)  # 初始化数据
    return jsonify({'success': True})

@bp_videos.route('/video-paths/index', methods=['POST'])
def index_video_path():
    data = request.get_json()
    path = data.get('path', '').strip()
    if not path or not os.path.isdir(path):
        return jsonify({'error': '路径无效'}), 400
    if request.args.get('del') == '1':
        paths = load_paths()
        if path in paths:
            paths.remove(path)
            save_paths(paths)
            del_videos_path(path)  # 删除数据
        return jsonify({'success': True})
    else:
        init_data_from_folder(path)
    
    return jsonify({'success': True})

@bp_videos.route('/videos', methods=['GET'])
def get_videos():
    """
    获取视频列表，支持分页、分数筛选、标签筛选、关键词搜索。
    支持流式响应（stream=true）。
    """
    session = Session()
    query = session.query(Video)
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 5))
    score = request.args.get('score')
    search = request.args.get('search')
    tags = request.args.get('tags')
    latest = request.args.get('latest')
    stream = request.args.get('stream', 'false').lower() == 'true'

    if score:
        query = query.filter(Video.score == int(score))
    if tags:
        for tag in tags.split(','):
            query = query.filter(Video.tags.like(f"%{tag}%"))
    if search:
        keywords = search.strip().split()
        for kw in keywords:
            query2 = query.filter(Video.filename.like(f"%{kw}%"))
            if query2.count() == 0:
                query2 = session.query(Video).filter(Video.detail.like(f"%{kw}%"))
            query = query2
                 
    query = query.order_by(Video.id.desc())
    if page_size:
        query = query.offset((page-1)*page_size).limit(page_size)
    else:
        query = query.limit(int(latest))
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

@bp_videos.route('/videos/count', methods=['GET'])
def get_videos_count():
    """
    获取视频总数（用于前端分页和随机页）。
    支持分数、标签、关键词筛选。
    """
    session = Session()
    query = session.query(Video)
    score = request.args.get('score')
    search = request.args.get('search')
    tags = request.args.get('tags')

    if score:
        query = query.filter(Video.score == int(score))
    if tags:
        for tag in tags.split(','):
            query = query.filter(Video.tags.like(f"%{tag}%"))
    if search:
        keywords = search.strip().split()
        for kw in keywords:
            query = query.filter(Video.filename.like(f"%{kw}%"))
    total = query.count()
    session.close()
    return jsonify({"total": total})
