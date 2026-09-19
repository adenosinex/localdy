# app.py
import os
from flask import Flask, render_template, request, make_response, jsonify
from flask_cors import CORS

from models import init_db
from api_videos import bp_videos
from api_modify import bp_modify

app = Flask(__name__, template_folder="templates", static_folder="static")

# =========================================================
# 1. CORS 配置
# =========================================================
# 开发阶段：允许所有来源
# 生产阶段：把 origins 换成明确白名单
 

# 如果你开发阶段想图省事，可以直接 origins="*"
CORS(
    app,
    resources={r"/*": {"origins": '*'}},
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    expose_headers=["Content-Type"],
    max_age=3600,
    supports_credentials=False,   # 若要带 cookie，改成 True 且 origins 必须是白名单
)


# =========================================================
# 2. 兜底：确保每个响应都带 CORS 头（防止某些异常路径漏掉）
# =========================================================
@app.after_request
def ensure_cors_headers(resp):
    origin = request.headers.get("Origin")
     
    resp.headers["Access-Control-Allow-Origin"] = origin
    resp.headers["Vary"] = "Origin"
    # 预检请求也补一下，防止某些情况 flask-cors 没覆盖
    if request.method == "OPTIONS":
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        resp.headers["Access-Control-Max-Age"] = "3600"
    return resp


# =========================================================
# 3. 蓝图注册
# =========================================================
app.register_blueprint(bp_videos)
app.register_blueprint(bp_modify)


# =========================================================
# 4. 首页
# =========================================================
@app.route("/")
def index():
    return render_template("index.html")


# =========================================================
# 5. 统一错误处理（JSON 接口返回 JSON，别把 HTML 错误页甩给前端）
# =========================================================
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/videos") or request.path.startswith("/modify"):
        return jsonify({"success": False, "error": "not found", "path": request.path}), 404
    return e, 404


@app.errorhandler(500)
def server_error(e):
    if request.path.startswith("/videos") or request.path.startswith("/modify"):
        return jsonify({"success": False, "error": "internal server error"}), 500
    return e, 500


# =========================================================
# 6. 初始化（只跑一次）
# =========================================================
_initialized = False

def initialize_app():
    global _initialized
    if _initialized:
        return
    _initialized = True

    print("[init] 执行一次初始化任务：加载数据、连接数据库等...")
    init_db()

    # 如果迁移逻辑在 models.py 里，这里调用一次
    try:
        from models import migrate_database
        migrate_database()
    except ImportError:
        pass


# =========================================================
# 7. 启动
# =========================================================
if __name__ == "__main__":
    # 注意：debug=True 会启动 reloader，父进程和子进程都会执行这里
    # 用 WERKZEUG_RUN_MAIN 判断，避免初始化跑两次
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        initialize_app()
    else:
        # reloader 第一次进这个分支，也可以调用一次
        initialize_app()

    # 端口 80 需要 root；非 root 环境用 5000
    app.run(debug=True, host="0.0.0.0", port=80)