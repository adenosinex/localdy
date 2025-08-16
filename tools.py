import os
from pathlib import Path
import shutil
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
                shutil.copy2(src, dst)  # copy2 会保留元数据
                print(f"文件已复制到 {dst}")
                
                # 2. 删除源文件
                os.remove(src)
                print(f"源文件 {src} 已删除")
               
                 
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

def copy_5score():
    """
    复制分数为5的记录
    """
    session = Session()
    files = session.query(Video).filter(Video.score == 5).all()
    dst = Path(r'\\UGREEN-1E55\xin_Y\0.保护\精华-短视频')
    ren = [[f.detail, dst.joinpath(Path(f.detail).name)] for f in files]
    for src, dest in ren:
        if os.path.getsize(src) > 100*1024*1024:
            print(f"文件 {src} 大小小于100mB，跳过复制。")
            continue
        if not dest.exists() :
            dest.parent.mkdir(parents=True, exist_ok=True)
             
            
            shutil.copy2(src, dest)
                 
             
    try:
        print("已复制分数为5的视频记录。")
    except Exception as e:
        print(f"复制操作失败: {e}")
    finally:
        session.close()
# del_1score()

 