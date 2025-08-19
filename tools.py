import os
from pathlib import Path
import shutil
import time
from models  import *

def del_1score(dirs):
    """
    删除分数为1的记录
    """
    
    dst_name='del '+time.strftime('%Y-%m-%d', time.localtime())
    session = Session()
    files= session.query(Video ).filter(Video.score == 1).all()
    dst_dir=Path(r'\\Synology\home\sync od\dy-fastnas\del')
    ren= [[f.detail,dst_dir.joinpath(Path(f.detail).name)] for f in files]
    for src, dest in ren:
        for i in dirs:
            if os.path.splitdrive(src)[0] == os.path.splitdrive(i)[0]:
                dest = Path(i).joinpath(dst_name, Path(dest).name)
                break
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
        src_path = Path(src)
        if 'B96-在mio-chan的咖' in dest.name:
            pass
        if src_path.exists():
            try:
                # 1. 移动源文件到目标目录
                os.renames(src_path, dest)
                print(f"文件已移动到 {dest}")
            except  :
                if os.path.getsize(src) > 200*1024*1024:
                    os.remove(src)
                    print(f"文件 {src} 大于100mB，跳过复制。 del")
                shutil.copy2(src, dest)  # copy2 会保留元数据
                print(f"文件已复制到 {dest}")
                
                # 2. 删除源文件
                os.remove(src)
                print(f"源文件 {src_path.name} 已删除")
            
                
        else:
            print(f"源文件不存在: {src_path.name}")
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
        if os.path.getsize(src) > 200*1024*1024:
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

 