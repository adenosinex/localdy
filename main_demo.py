import sqlite3
import re

DB_PATH = "videos.db"

def extract_tags(filename):
    """
    从文件名中提取标签（tags）。
    标签规则：
    - 主标签为第一个空格后到第一个#前的字符串，若无#则取最后一个空格后的字符串。
    - 其它标签为所有#后面的字符串（如#玛莎拉、#好久不见）。
    返回：标签列表（可能为空）。
    """
    # 提取第一个空格后到第一个#前的字符串作为主tag
    main_tag_match = filename.split(' ' )[0] 
    tags = []
    if main_tag_match:
        tags.append(main_tag_match.group(1))
   
    # 提取所有#tag
    tags += re.findall(r'#([\u4e00-\u9fa5\w]+)', filename)
    return tags

def init_db():
    """
    初始化数据库，创建videos表（如不存在）。
    字段：id、filename、tags、score、detail。
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            tags TEXT,
            score INTEGER DEFAULT 0,
            detail TEXT DEFAULT ''
        )
    ''')
    conn.commit()
    conn.close()

def add_video(filename, score=0, detail=''):
    """
    添加视频记录到数据库。
    自动从文件名提取标签，存储filename、tags、score、detail。
    """
    tags = extract_tags(filename)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO videos (filename, tags, score, detail)
        VALUES (?, ?, ?, ?)
    ''', (filename, ','.join(tags), score, detail))
    conn.commit()
    conn.close()

def get_latest_videos(page=1, page_size=10):
    """
    获取最新视频，分页返回。
    参数：页码page，单页数量page_size。
    返回：视频元组列表。
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT id, filename, tags, score, detail
        FROM videos
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    ''', (page_size, (page-1)*page_size))
    videos = c.fetchall()
    conn.close()
    return videos

def filter_by_score(score):
    """
    按评分筛选视频。
    参数：score分数。
    返回：视频元组列表。
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT id, filename, tags, score, detail
        FROM videos
        WHERE score=?
        ORDER BY id DESC
    ''', (score,))
    videos = c.fetchall()
    conn.close()
    return videos

def filter_by_tags(tags):
    """
    按标签筛选视频。
    参数：tags标签列表或集合。
    返回：视频元组列表。
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    query = "SELECT id, filename, tags, score, detail FROM videos WHERE "
    query += " AND ".join(["tags LIKE ?"] * len(tags))
    params = [f"%{tag}%" for tag in tags]
    c.execute(query, params)
    videos = c.fetchall()
    conn.close()
    return videos

def search_videos(keyword):
    """
    按关键词搜索视频。
    参数：keyword关键词。
    返回：视频元组列表。
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT id, filename, tags, score, detail
        FROM videos
        WHERE filename LIKE ? OR detail LIKE ?
        ORDER BY id DESC
    ''', (f"%{keyword}%", f"%{keyword}%"))
    videos = c.fetchall()
    conn.close()
    return videos

def show_video_detail(video_id):
    """
    显示指定视频详情，并打印相关信息。
    参数：video_id视频ID。
    返回：视频元组或None。
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT id, filename, tags, score, detail
        FROM videos
        WHERE id=?
    ''', (video_id,))
    video = c.fetchone()
    conn.close()
    if video:
        print(f"文件名: {video[1]}")
        print(f"标签: {video[2]}")
        print(f"评分: {video[3]}")
        print(f"详情: {video[4]}")
        print("操作: 下载 | 分享 | 评论")
        return video
    return None

def responsive_display(device):
    """
    响应式布局展示。
    参数：device设备类型（mobile/tablet/pc）。
    """
    if device == "mobile":
        print("移动端布局")
    elif device == "tablet":
        print("平板端布局")
    else:
        print("PC端布局")

def main():
    """
    主流程演示：初始化数据库、添加视频、各功能演示。
    """
    init_db()
    add_video("阿啵饽 2025-08f 15.6 KB 考古#玛莎拉 #好久不见", score=5, detail="考古视频")
    add_video("小猫咪 2025-08f 12.3 KB 宠物#可爱", score=4, detail="宠物视频")
    current_videos = get_latest_videos()
    print("最新视频列表:", [v[1] for v in current_videos])
    filtered = filter_by_score(5)
    print("5分视频:", [v[1] for v in filtered])
    filtered = filter_by_tags(["考古", "玛莎拉"])
    print("考古+玛莎拉标签视频:", [v[1] for v in filtered])
    result = search_videos("猫")
    print("搜索结果:", [v[1] for v in result])
    print("当前筛选条件:", ["考古", "玛莎拉"], 5)
    show_video_detail(1)
    responsive_display("mobile")

if __name__ == "__main__":
    main()