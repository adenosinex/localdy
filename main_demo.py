from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
import re

DB_PATH = "sqlite:///videos.db"
Base = declarative_base()

class Video(Base):
    __tablename__ = 'videos'
    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String)
    tags = Column(String)
    score = Column(Integer, default=0)
    detail = Column(String, default='')

def extract_tags(filename):
    """
    从文件名中提取标签（tags）。
    标签规则：
    - 主标签为第一个空格后到第一个#前的字符串，若无#则取最后一个空格后的字符串。
    - 其它标签为所有#后面的字符串（如#玛莎拉、#好久不见）。
    返回：标签列表（可能为空）。
    """
    # 提取第一个空格后到第一个#前的字符串作为主tag
    main_tag_match = filename.split(' ' )[0] 
    tags = []
    if main_tag_match:
        tags.append(main_tag_match.group(1))
   
    # 提取所有#tag
    tags += re.findall(r'#([\u4e00-\u9fa5\w]+)', filename)
    return tags

engine = create_engine(DB_PATH, echo=False)
Session = sessionmaker(bind=engine)

def init_db():
    """
    初始化数据库，创建videos表（如不存在）。
    """
    Base.metadata.create_all(engine)

def add_video(filename, score=0, detail=''):
    """
    添加视频记录到数据库。
    自动从文件名提取标签，存储filename、tags、score、detail。
    """
    tags = extract_tags(filename)
    session = Session()
    video = Video(filename=filename, tags=','.join(tags), score=score, detail=detail)
    session.add(video)
    session.commit()
    session.close()

def get_latest_videos(page=1, page_size=10):
    """
    获取最新视频，分页返回。
    返回：视频对象列表。
    """
    session = Session()
    videos = session.query(Video).order_by(Video.id.desc()).offset((page-1)*page_size).limit(page_size).all()
    session.close()
    return videos

def filter_by_score(score):
    """
    按评分筛选视频。
    返回：视频对象列表。
    """
    session = Session()
    videos = session.query(Video).filter(Video.score == score).order_by(Video.id.desc()).all()
    session.close()
    return videos

def filter_by_tags(tags):
    """
    按标签筛选视频。
    返回：视频对象列表。
    """
    session = Session()
    query = session.query(Video)
    for tag in tags:
        query = query.filter(Video.tags.like(f"%{tag}%"))
    videos = query.order_by(Video.id.desc()).all()
    session.close()
    return videos

def search_videos(keyword):
    """
    按关键词搜索视频。
    返回：视频对象列表。
    """
    session = Session()
    videos = session.query(Video).filter(
        (Video.filename.like(f"%{keyword}%")) | (Video.detail.like(f"%{keyword}%"))
    ).order_by(Video.id.desc()).all()
    session.close()
    return videos

def show_video_detail(video_id):
    """
    显示指定视频详情，并打印相关信息。
    返回：视频对象或None。
    """
    session = Session()
    video = session.query(Video).filter(Video.id == video_id).first()
    session.close()
    if video:
        print(f"文件名: {video.filename}")
        print(f"标签: {video.tags}")
        print(f"评分: {video.score}")
        print(f"详情: {video.detail}")
        print("操作: 下载 | 分享 | 评论")
        return video
    return None

def responsive_display(device):
    """
    响应式布局展示。
    参数：device设备类型（mobile/tablet/pc）。
    """
    if device == "mobile":
        print("移动端布局")
    elif device == "tablet":
        print("平板端布局")
    else:
        print("PC端布局")

def main():
    """
    主流程演示：初始化数据库、添加视频、各功能演示。
    """
    init_db()
    add_video("阿啵饽 2025-08f 15.6 KB 考古#玛莎拉 #好久不见", score=5, detail="考古视频")
    add_video("小猫咪 2025-08f 12.3 KB 宠物#可爱", score=4, detail="宠物视频")
    current_videos = get_latest_videos()
    print("最新视频列表:", [v.filename for v in current_videos])
    filtered = filter_by_score(5)
    print("5分视频:", [v.filename for v in filtered])
    filtered = filter_by_tags(["考古", "玛莎拉"])
    print("考古+玛莎拉标签视频:", [v.filename for v in filtered])
    result = search_videos("猫")
    print("搜索结果:", [v.filename for v in result])
    print("当前筛选条件:", ["考古", "玛莎拉"], 5)
    show_video_detail(1)
    responsive_display("mobile")


if __name__ == "__main__":
    main()