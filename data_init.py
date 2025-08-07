import os
from models import Video, extract_tags, Session, init_db
from sqlalchemy.exc import IntegrityError

def add_video_record(filename, tags, score, detail):
    session = Session()
    video = Video(filename=filename, tags=','.join(tags), score=score, detail=detail)
    session.add(video)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
    session.close()

def init_data_from_folder(root_folder):
    """
    遍历指定文件夹及子文件夹，将所有文件写入数据库。
    id自增，detail为文件所在文件夹名（即类别）。
    """
    init_db()
    for dirpath, dirnames, filenames in os.walk(root_folder):
        folder_name = os.path.basename(dirpath)
        for fname in filenames:
            # 跳过隐藏文件或非视频文件（可按需扩展过滤条件）
            if fname.startswith('.'):
                continue
            full_path = os.path.join(dirpath, fname)
            tags = extract_tags(fname)
            add_video_record(fname, tags, score=0, detail=full_path)

if __name__ == "__main__":
    # 修改为你的视频根目录路径
    video_root = r"C:\\Users\\xin\\Documents\\codgit\\downfile-server\\links\\2025-08-06 auto"
    init_data_from_folder(video_root)