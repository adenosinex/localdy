import os
import time
from models import Video, extract_tags, Session, init_db
from sqlalchemy.exc import IntegrityError
 
 
from sqlalchemy import select

def add_video_records_batch(video_list):
    """
    批量添加视频记录，已存在的文件名跳过。
    
    video_list: [
        {'filename': 'xxx.mp4', 'tags': ['tag1', 'tag2'], 'score': 5, 'detail': 'path'},
        ...
    ]
    """
    if not video_list:
        print("视频列表为空，无需添加。")
        return
    
    session = Session()
    
     
    # 提取所有待添加的文件名
    filenames_to_add = [item['filename'] for item in video_list]
    
    # 查询数据库中已存在的文件名
    existing_filenames = session.query(Video.filename).filter(
        Video.filename.in_(filenames_to_add)
    ).all()
    existing_filenames = {row.filename for row in existing_filenames}  # 转为集合，便于查找
    
    # 过滤：只添加不存在的
    new_videos = []
    skipped_count = 0
    
    for item in video_list:
        if item['filename'] in existing_filenames:
            print(f"视频 {item['filename']} 已存在，跳过添加。")
            skipped_count += 1
        else:
            new_videos.append({
                'filename': item['filename'],
                'tags': ','.join(item['tags']) if isinstance(item['tags'], list) else item['tags'],
                'score': item['score'],
                'detail': item['detail']
            })
    
    if new_videos:
        # 使用 bulk_insert_mappings 批量插入，性能更高
        session.bulk_insert_mappings(Video, new_videos)
        session.commit()
        print(f"成功批量添加 {len(new_videos)} 个新视频。")
    else:
        print("没有新视频需要添加。")
        
    return len(new_videos), skipped_count
        
 
def add_video_record(filename, tags, score, detail):
    session = Session()
    oldv=session.query(Video).filter(Video.filename == filename) 
    if oldv.count() > 0:
        print(f"视频 {filename} 已存在，跳过添加。")
        session.close()
        return 1
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
    print(f"开始从文件夹 {root_folder} 初始化数据...")
    start_time=time.time()
    videos=[]
    max_length = 10  # 每次批量添加的最大记录数
    for dirpath, dirnames, filenames in os.walk(root_folder):
        folder_name = os.path.basename(dirpath)
        for fname in filenames:
            # 跳过隐藏文件或非视频文件（可按需扩展过滤条件）
            if fname.startswith('.'):
                continue
            if not fname.lower().endswith(('.mp4', '.avi', '.mkv', '.mov', '.flv')):
                continue
            full_path = os.path.join(dirpath, fname)
            tags = extract_tags(fname)
            videos.append({'filename': fname,
                           'tags': tags,
                           'score': 0,  # 默认评分
                           'detail': full_path})
            max_length -= 1
        if max_length <= 0:
            pass
            # break
    cnt,error=add_video_records_batch(videos)
    print(f"批量添加视频记录完成，耗时：{time.time() - start_time:.2f}秒")
    print(f"数据初始化完成。共添加视频文件：{cnt}, 跳过已存在的视频：{error}")
if __name__ == "__main__":
    # 修改为你的视频根目录路径
    # video_root = input("请输入视频根目录路径：")
    video_root=r'\\Synology\home\sync od\dy-fastnas\3.重点用户'
    init_data_from_folder(video_root)