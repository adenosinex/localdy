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
    main_tag_match = filename.split(' ')[0]
    tags = [main_tag_match]
    tags += re.findall(r'#([\u4e00-\u9fa5\w]+)', filename)
    return tags

engine = create_engine(DB_PATH, echo=False)
Session = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)