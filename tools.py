from pathlib import Path
from models  import *

def del_1score():
    """
    删除分数为1的记录
    """
    session = Session()
    files= session.query(Video ).filter(Video.score == 1).all()
    dst=Path(r'\\Synology\home\sync od\dy-fastnas\del')
    ren= [[f.detail,dst.joinpath(Path(f.detail).name)] for f in files]
    for src, dest in ren:
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            src_path = Path(src)
            if src_path.exists():
                src_path.rename(dest)
                 
            else:
                print(f"源文件不存在: {src}")
    try:
        session.query(Video).filter(Video.score == 1).delete(synchronize_session=False)
        session.commit()
        print("已删除分数为1的视频记录。")
    except Exception as e:
        session.rollback()
        print(f"删除操作失败: {e}")
    finally:
        session.close()

del_1score()