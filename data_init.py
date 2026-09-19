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
    filenames_to_add = [item['detail'] for item in video_list]
    
    # 查询数据库中已存在的文件名
    existing_filenames = session.query(Video.detail).filter(
        Video.detail.in_(filenames_to_add)
    ).all()
    existing_filenames = {row.detail for row in existing_filenames}  # 转为集合，便于查找
    
    # 过滤：只添加不存在的
    new_videos = []
    skipped_count = 0
    
    for item in video_list:
        if item['detail'] in existing_filenames:
            # print(f"视频 {item['filename']} 已存在，跳过添加。")
            skipped_count += 1
        else:
            new_videos.append({
                'filename': item['filename'],
                'tags': ','.join(item['tags']) if isinstance(item['tags'], list) else item['tags'],
                'score': item['score'],
                'detail': item['detail'],
                'file_size': item.get('file_size', 0)
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
        # print(f"视频 {filename} 已存在，跳过添加。")
        session.close()
        return 1
    video = Video(filename=filename, tags=','.join(tags), score=score, detail=detail)
    
    session.add(video)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
    session.close()
 
def del_videos_path(path):
    """
    删除指定路径下的视频记录
    """
    session = Session()
    try:
        deleted_count = session.query(Video).filter(Video.detail.like(f'%{path}%')).delete(synchronize_session=False)
        session.commit()
        print(f"已删除路径 {path} 下的 {deleted_count} 条视频记录。")
    except Exception as e:
        session.rollback()
        print(f"删除操作失败: {e}")
    finally:
        session.close()
import os
import sys
import time
import inspect
from datetime import datetime

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False


VIDEO_EXTS = ('.mp4', '.avi', '.mkv', '.mov', '.flv')


def format_size(num_bytes):
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} PB"


def format_duration(seconds):
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h{m:02d}m{s:02d}s"
    if m:
        return f"{m}m{s:02d}s"
    return f"{s}s"


def _supports_batch_size(func):
    try:
        return 'batch_size' in inspect.signature(func).parameters
    except (TypeError, ValueError):
        return False


def fast_scan(root_folder):
    """
    单次递归遍历，同时拿到 (完整路径, 文件名, 文件大小)。
    Windows/SMB 下 entry.stat() 会复用目录枚举的缓存信息，
    不为每个文件再发一次网络请求。
    """
    results = []
    stack = [root_folder]
    dir_errors = 0
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for entry in it:
                    name = entry.name
                    if name.startswith('.'):
                        continue
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            stack.append(entry.path)
                            continue
                        if not entry.is_file(follow_symlinks=False):
                            continue
                    except OSError:
                        continue
                    if not name.lower().endswith(VIDEO_EXTS):
                        continue
                    try:
                        size = entry.stat(follow_symlinks=False).st_size
                    except OSError:
                        size = 0
                    results.append((entry.path, name, size))
        except OSError as e:
            dir_errors += 1
            print(f"  [skip] 无法访问目录 {d}: {e}")
    if dir_errors:
        print(f"  [warn] 共 {dir_errors} 个目录无法访问")
    return results


def init_data_from_folder(root_folder, batch_size=500):
    """
    边扫描边分批入库，兼容 SMB 网络共享。
    """
    init_db()

    overall_start = time.time()
    overall_start_dt = datetime.now()
    print("=" * 72)
    print(f"[{overall_start_dt:%Y-%m-%d %H:%M:%S}] 开始初始化：{root_folder}")
    print(f"  批大小: {batch_size} 条/批")
    print("=" * 72)

    # =========================================================
    # 阶段 1：一次性扫描（同时拿到 size）
    # =========================================================
    print(f"[{datetime.now():%H:%M:%S}] 阶段1：扫描文件并读取大小...")
    t0 = time.time()
    files = fast_scan(root_folder)
    scan_cost = time.time() - t0
    total_files = len(files)
    total_size_all = sum(s for _, _, s in files)
    print(
        f"[{datetime.now():%H:%M:%S}] 阶段1完成：{total_files} 个视频，"
        f"总大小 {format_size(total_size_all)}，耗时 {format_duration(scan_cost)}"
    )
    if total_files == 0:
        print("没有找到任何视频文件，退出。")
        return

    # =========================================================
    # 阶段 2：逐批处理 + 入库
    # =========================================================
    print(f"[{datetime.now():%H:%M:%S}] 阶段2：分批处理 + 入库...")
    phase2_start = time.time()

    batch = []
    total_size = 0
    total_added = 0
    total_skipped = 0
    on_disk = set()
    use_kw = _supports_batch_size(add_video_records_batch)
    tag_time = 0.0   # 累计 extract_tags 耗时

    if HAS_TQDM:
        iterator = tqdm(
            files,
            total=total_files,
            desc="处理中",
            unit="file",
            ncols=110,
            file=sys.stdout,
            bar_format=(
                "{l_bar}{bar}| {n_fmt}/{total_fmt} "
                "[{elapsed}<{remaining}, {rate_fmt}] {postfix}"
            ),
        )
    else:
        iterator = files

    log_step = max(500, total_files // 100)

    def flush():
        nonlocal total_added, total_skipped, batch
        if not batch:
            return
        try:
            if use_kw:
                c, e = add_video_records_batch(batch, batch_size=len(batch))
            else:
                c, e = add_video_records_batch(batch)
            total_added += c or 0
            total_skipped += e or 0
        except Exception as ex:
            msg = f"[!] 写库失败，本批 {len(batch)} 条被丢弃: {ex}"
            if HAS_TQDM:
                iterator.write(msg)
            else:
                print(msg)
        finally:
            batch = []

    for i, (full_path, fname, size) in enumerate(iterator, 1):
        total_size += size
        on_disk.add(full_path)

        t_tag = time.perf_counter()
        tags = extract_tags(fname)
        tag_time += time.perf_counter() - t_tag

        batch.append({
            'filename': fname,
            'tags': tags,
            'score': 0,
            'detail': full_path,
            'file_size': size,
        })

        if len(batch) >= batch_size:
            flush()

        if HAS_TQDM:
            iterator.set_postfix_str(
                f"+{total_added} ~{total_skipped} {format_size(total_size)}"
            )
        else:
            if i % log_step == 0 or i == total_files:
                elapsed = time.time() - phase2_start
                speed = i / elapsed if elapsed > 0 else 0
                eta = (total_files - i) / speed if speed > 0 else 0
                print(
                    f"[{datetime.now():%H:%M:%S}] {i}/{total_files} "
                    f"({i*100/total_files:5.1f}%) "
                    f"+{total_added} ~{total_skipped} "
                    f"{format_size(total_size)} "
                    f"{speed:.0f} file/s 剩余 {format_duration(eta)}"
                )

    flush()
    phase2_cost = time.time() - phase2_start
    print(
        f"[{datetime.now():%H:%M:%S}] 阶段2完成："
        f"处理 {total_files} 条，新增 {total_added}，跳过 {total_skipped}，"
        f"耗时 {format_duration(phase2_cost)}"
    )
    print(
        f"  其中 extract_tags 累计耗时: {format_duration(tag_time)} "
        f"（占阶段2 {tag_time/phase2_cost*100:.1f}%）"
    )

    # =========================================================
    # 阶段 3：清理失效记录
    # =========================================================
    print(f"[{datetime.now():%H:%M:%S}] 阶段3：清理失效记录...")
    clean_start = time.time()
    deleted = 0
    session = Session()
    try:
        pattern = f'%{root_folder}%'
        rows = session.query(Video.id, Video.detail).filter(
            Video.detail.like(pattern)
        ).all()
        db_details = {row.detail for row in rows}
        to_delete = db_details - on_disk

        if to_delete:
            print(f"  发现 {len(to_delete)} 条失效记录，正在删除...")
            del_list = list(to_delete)
            for j in range(0, len(del_list), 500):
                chunk = del_list[j:j + 500]
                deleted += session.query(Video).filter(
                    Video.detail.in_(chunk),
                    Video.detail.like(pattern),
                ).delete(synchronize_session="fetch")
                session.commit()
        else:
            print("  没有需要清理的记录。")
    except Exception as e:
        session.rollback()
        print(f"  清理失败: {e}")
    finally:
        session.close()

    print(
        f"[{datetime.now():%H:%M:%S}] 阶段3完成："
        f"删除 {deleted} 条，耗时 {format_duration(time.time() - clean_start)}"
    )

    # =========================================================
    # 汇总
    # =========================================================
    overall_cost = time.time() - overall_start
    overall_end_dt = datetime.now()
    print("=" * 72)
    print("初始化完成")
    print(f"  开始时间   : {overall_start_dt:%Y-%m-%d %H:%M:%S}")
    print(f"  结束时间   : {overall_end_dt:%Y-%m-%d %H:%M:%S}")
    print(f"  总耗时     : {format_duration(overall_cost)}")
    print(f"  扫描文件   : {total_files} 个")
    print(f"  新增入库   : {total_added} 条")
    print(f"  跳过已存在 : {total_skipped} 条")
    print(f"  删除失效   : {deleted} 条")
    print(f"  总大小     : {format_size(total_size)}")
    if overall_cost > 0:
        print(f"  平均速率   : {total_files/overall_cost:.1f} file/s")
    print("=" * 72)