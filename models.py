from sqlalchemy import create_engine, Column, Integer, String, BigInteger, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError
import re

DB_PATH = "sqlite:///videos.db"
Base = declarative_base()

class Video(Base):
    __tablename__ = 'videos'
    id = Column(Integer, primary_key=True)
    filename = Column(String)
    detail = Column(String)  # 路径
    tags = Column(String)
    score = Column(Integer)
    file_size = Column(BigInteger, default=0)  # 文件大小，单位：字节

def delete_video(video_id):
    """
    删除指定视频记录。
    """
    session = Session()
    video = session.query(Video).filter(Video.id == video_id).first()
    if video:
        session.delete(video)
        session.commit()
        session.close()
        return True
    session.close()
    return False

def extract_tags(filename):
    """
    从文件名中提取标签（tags）。
    标签规则：
    - 主标签为第一个空格后到第一个#前的字符串，若无#则取最后一个空格后的字符串。
    - 其它标签为所有#后面的字符串（如#玛莎拉、#好久不见）。
    返回：标签列表（可能为空）。
    """
    main_tag_match = filename.split(' ')[0]
    tags = [main_tag_match]
    tags += re.findall(r'#([\u4e00-\u9fa5\w]+)', filename)
    return tags

engine = create_engine(DB_PATH, echo=False)
Session = sessionmaker(bind=engine)

def init_db():
    """初始化数据库，自动添加缺失的字段以保持兼容性"""
    Base.metadata.create_all(engine)
    
    # 检查并添加缺失的字段
    try:
        with engine.connect() as conn:
            # 检查是否存在 file_size 字段
            result = conn.execute(text("PRAGMA table_info(videos)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'file_size' not in columns:
                print("添加 file_size 字段到数据库...")
                conn.execute(text("ALTER TABLE videos ADD COLUMN file_size BIGINT DEFAULT 0"))
                conn.commit()
                print("file_size 字段添加成功")
                
                # 为现有记录更新文件大小
                update_existing_file_sizes()
                
    except OperationalError as e:
        print(f"数据库字段检查/添加时出错: {e}")

def update_existing_file_sizes():
    """为现有记录更新文件大小"""
    import os
    session = Session()
    try:
        videos_without_size = session.query(Video).filter(
            (Video.file_size == None) | (Video.file_size == 0)
        ).all()
        
        updated_count = 0
        for video in videos_without_size:
            try:
                if os.path.exists(video.detail):
                    file_size = os.path.getsize(video.detail)
                    video.file_size = file_size
                    updated_count += 1
            except (OSError, AttributeError):
                video.file_size = 0
        
        if updated_count > 0:
            session.commit()
            print(f"已更新 {updated_count} 个视频的文件大小信息")
        
    except Exception as e:
        session.rollback()
        print(f"更新文件大小时出错: {e}")
    finally:
        session.close()