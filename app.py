from flask import Flask, render_template
from models import init_db
from api_videos import bp_videos
from api_modify import bp_modify

app = Flask(__name__, template_folder="templates", static_folder="static")

 
# 初始化标志
initialized = False

def initialize_app():
    print("执行一次初始化任务：加载数据、连接数据库等...")
    # 你的初始化代码
    global initialized
    initialized = True

@app.before_request
def setup():
    init_db()

app.register_blueprint(bp_videos)
app.register_blueprint(bp_modify)

@app.route('/')
def index():
    # 渲染前端主页面
    return render_template('index.html')

if __name__ == "__main__":
    app.run(debug=True)