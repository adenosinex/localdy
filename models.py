from sqlalchemy import create_engine, Column, Integer, String, BigInteger, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError
import re

DB_PATH = "sqlite:///videos.db"
Base = declarative_base()
import re
import unicodedata

def normalize_text(s: str) -> str:
    """
    规范化文本：去掉所有空白、标点、符号，统一小写。
    例："A 。" -> "a"，"a。" -> "a"，"C++ 教程" -> "c教程"
    """
    if not s:
        return ''
    out = []
    for ch in s:
        # 去掉所有空白（半角空格、全角空格 \u3000、tab、换行等）
        if ch.isspace():
            continue
        
        out.append(ch)
    return ''.join(out).lower()

class Video(Base):
    __tablename__ = 'videos'
    id = Column(Integer, primary_key=True)
    filename = Column(String)
    filename_norm = Column(String, index=True)  # 新增：规范化后的文件名
    detail = Column(String)  # 路径
    tags = Column(String)
    score = Column(Integer)
    file_size = Column(BigInteger, default=0)  # 文件大小，单位：字节

from sqlalchemy import event

@event.listens_for(Video, 'before_insert')
@event.listens_for(Video, 'before_update')
def _fill_filename_norm(mapper, connection, target):
    target.filename_norm = normalize_text(target.filename)


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
    
    # 执行数据库迁移
    migrate_database()

def migrate_database():
    """执行数据库迁移，添加缺失的字段并更新数据"""
    migrations = [
        {
            'field': 'file_size',
            'sql': 'ALTER TABLE videos ADD COLUMN file_size BIGINT DEFAULT 0',
            'update_function': update_existing_file_sizes,
            'description': '文件大小字段'
        }
        # 未来可以在这里添加更多迁移
        # {
        #     'field': 'duration',
        #     'sql': 'ALTER TABLE videos ADD COLUMN duration INTEGER DEFAULT 0',
        #     'update_function': update_existing_durations,
        #     'description': '视频时长字段'
        # }
    ]
    
    try:
        with engine.connect() as conn:
            # 获取当前表结构
            result = conn.execute(text("PRAGMA table_info(videos)"))
            existing_columns = [row[1] for row in result.fetchall()]
            
            # 执行每个迁移
            for migration in migrations:
                field_name = migration['field']
                if field_name not in existing_columns:
                    print(f"添加 {migration['description']} ({field_name}) 到数据库...")
                    try:
                        conn.execute(text(migration['sql']))
                        conn.commit()
                        print(f"{field_name} 字段添加成功")
                        
                        # 执行数据更新函数
                        if migration.get('update_function'):
                            print(f"开始更新现有记录的 {field_name} 数据...")
                            migration['update_function']()
                        
                    except Exception as e:
                        print(f"添加字段 {field_name} 时出错: {e}")
                        conn.rollback()
                else:
                    print(f"字段 {field_name} 已存在，跳过迁移")
                    
    except OperationalError as e:
        print(f"数据库迁移时出错: {e}")

def update_existing_file_sizes():
    """为现有记录更新文件大小"""
    import os
    session = Session()
    try:
        # 查找文件大小为空或为0的记录
        videos_without_size = session.query(Video).filter(
            (Video.file_size == None) | (Video.file_size == 0)
        ).all()
        
        if not videos_without_size:
            print("所有记录已有文件大小信息")
            return
        
        updated_count = 0
        batch_size = 100  # 批量处理，避免内存问题
        
        for i, video in enumerate(videos_without_size):
            try:
                if video.detail and os.path.exists(video.detail):
                    file_size = os.path.getsize(video.detail)
                    video.file_size = file_size
                    updated_count += 1
                else:
                    video.file_size = 0
                    
                # 批量提交，提高性能
                if (i + 1) % batch_size == 0:
                    session.commit()
                    print(f"已处理 {i + 1}/{len(videos_without_size)} 条记录")
                    
            except (OSError, AttributeError) as e:
                print(f"处理视频 {video.filename} 时出错: {e}")
                video.file_size = 0
        
        # 提交剩余的更改
        session.commit()
        print(f"文件大小更新完成，共更新 {updated_count} 个视频记录")
        
    except Exception as e:
        session.rollback()
        print(f"更新文件大小时出错: {e}")
    finally:
        session.close()

def add_new_field_migration(field_name, sql_statement, update_function=None, description=""):
    """
    添加新字段迁移的辅助函数
    
    Args:
        field_name: 字段名
        sql_statement: SQL语句
        update_function: 数据更新函数（可选）
        description: 字段描述
    """
    # 这个函数为未来扩展提供便利
    # 可以动态添加新的字段迁移而不需要修改核心代码
    pass