import os
from pathlib import Path
import shutil
import time
from models  import *

def create_1kb_file(filename):
    with open(filename, 'wb') as f:
        f.write(b'\0' * 1024)  # 写入 1024 个空字节
     

import os
from datetime import datetime

def create_file_info_report(src,dst):
    # 检查输入文件是否存在
    if not os.path.isfile(src):
        print(f"❌ 错误：文件 '{src}' 不存在或不是文件。")
        return

    # 获取文件信息
    file_stat = os.stat(src)
    file_name = os.path.basename(src)  # 提取文件名
    file_size = file_stat.st_size  # 文件大小（字节）
    file_size_kb = file_size / 1024  # 转换为 KB
    file_size_mb = file_size / (1024 * 1024)  # 转换为 MB
    modified_time = datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
    created_time = datetime.fromtimestamp(file_stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S')
    file_dir = os.path.dirname(src) or "当前目录"

    

    # 写入信息到新文件
    with open(str(dst)+'.txt', 'w', encoding='utf-8') as f:
        f.write("=" * 50 + "\n")
        f.write("📄 文件信息报告\n")
        f.write("=" * 50 + "\n")
        f.write(f"原始文件名: {file_name}\n")
        f.write(f"完整路径: {src}\n")
        f.write(f"文件大小: {file_size} 字节\n")
        f.write(f"         : {file_size_kb:.2f} KB\n")
        f.write(f"         : {file_size_mb:.2f} MB\n")
        f.write(f"创建时间: {created_time}\n")
        f.write(f"修改时间: {modified_time}\n")
        f.write(f"所在目录: {file_dir}\n")
        f.write("=" * 50 + "\n")
        f.write("✅ 此文件由 Python 自动生成。\n")

    
 
def del_1score(dirs):
    """
    删除分数为1的记录
    """
    cnt=0
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
            cnt+=1
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
    print(f"共处理分数为1的视频文件：{cnt}")

def copy_5score():
    """
    复制分数为5的记录
    """
    cnt=0
    session = Session()
    files = session.query(Video).filter(Video.score == 5).all()
    dst = Path(r'\\UGREEN-1E55\xin_Y\0.保护\精华-短视频')
    dst_bigempt=dst.joinpath('大文件信息')
    ren = [[f.detail, dst.joinpath(Path(f.detail).name)] for f in files]
    for src, dest in ren:
        if not os.path.exists(src) or os.path.exists(dest):
           
            continue
        cnt+=1
        if os.path.getsize(src) > 500*1024*1024 :
            print(f"文件 {src} 大小小于500mB，跳过复制。")
            if not dst_bigempt.exists():
                dst_bigempt.mkdir(parents=True, exist_ok=True)
            create_file_info_report(src, dst_bigempt.joinpath(Path(src).name))
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
    print(f"共处理分数为5的视频文件：{cnt}")
# del_1score()

 