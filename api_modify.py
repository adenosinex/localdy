from flask import Blueprint, request, jsonify
from models import Video, extract_tags, Session

bp_modify = Blueprint('modify', __name__)

@bp_modify.route('/videos', methods=['POST'])
def add_video():
    """
    添加视频记录。
    参数：filename, score, detail
    自动提取tags
    """
    data = request.json
    filename = data.get('filename')
    score = int(data.get('score', 0))
    detail = data.get('detail', '')
    tags = extract_tags(filename)
    session = Session()
    video = Video(filename=filename, tags=','.join(tags), score=score, detail=detail)
    session.add(video)
    session.commit()
    vid = video.id
    session.close()
    return jsonify({"id": vid, "filename": filename, "tags": ','.join(tags), "score": score, "detail": detail})

# 可扩展PUT/DELETE等接口