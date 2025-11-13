"""
Google Flow 批量提交工具 - GUI 界面
使用 Tkinter 创建用户友好的配置界面
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import subprocess
import sys
import os
import json


class FlowGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Google Flow 批量提交工具")
        self.root.geometry("950x850")

        # 设置窗口图标
        icon_path = os.path.join(os.path.dirname(__file__), "window_icon.png")
        if os.path.exists(icon_path):
            try:
                icon = tk.PhotoImage(file=icon_path)
                self.root.iconphoto(True, icon)
            except Exception as e:
                print(f"加载图标失败: {e}")

        # 运行状态
        self.is_running = False
        self.process = None

        # 配置文件路径
        self.config_file = os.path.join(os.path.dirname(__file__), ".flow_gui_config.json")

        # 创建主容器
        main_frame = ttk.Frame(root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # 配置网格权重
        root.columnconfigure(0, weight=1)
        root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)

        current_row = 0

        # ===== 基础配置 =====
        ttk.Label(main_frame, text="基础配置", font=('', 12, 'bold')).grid(
            row=current_row, column=0, columnspan=3, sticky=tk.W, pady=(0, 10)
        )
        current_row += 1

        # 提示词文件
        ttk.Label(main_frame, text="提示词文件:").grid(row=current_row, column=0, sticky=tk.W, pady=5)
        self.prompts_file = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.prompts_file, width=50).grid(
            row=current_row, column=1, sticky=(tk.W, tk.E), pady=5
        )
        ttk.Button(main_frame, text="浏览...", command=self.browse_prompts_file).grid(
            row=current_row, column=2, padx=(5, 0), pady=5
        )
        current_row += 1

        # Profile ID
        ttk.Label(main_frame, text="Profile ID:").grid(row=current_row, column=0, sticky=tk.W, pady=5)
        self.profile_id = tk.StringVar(value="kpcl6vt")
        ttk.Entry(main_frame, textvariable=self.profile_id, width=50).grid(
            row=current_row, column=1, sticky=(tk.W, tk.E), pady=5
        )
        current_row += 1

        # 下载目录
        ttk.Label(main_frame, text="下载目录:").grid(row=current_row, column=0, sticky=tk.W, pady=5)
        self.download_dir = tk.StringVar(value="/Users/zzf/youtube/baby长视频素材/new")
        ttk.Entry(main_frame, textvariable=self.download_dir, width=50).grid(
            row=current_row, column=1, sticky=(tk.W, tk.E), pady=5
        )
        ttk.Button(main_frame, text="浏览...", command=self.browse_download_dir).grid(
            row=current_row, column=2, padx=(5, 0), pady=5
        )
        current_row += 1

        # ===== 高级配置（三列布局）=====
        ttk.Separator(main_frame, orient='horizontal').grid(
            row=current_row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=15
        )
        current_row += 1

        # 创建三列容器
        config_container = ttk.Frame(main_frame)
        config_container.grid(row=current_row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        config_container.columnconfigure(0, weight=1)
        config_container.columnconfigure(1, weight=1)
        config_container.columnconfigure(2, weight=1)

        # ===== 第一列：执行参数 =====
        exec_frame = ttk.LabelFrame(config_container, text="执行参数", padding=10)
        exec_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N), padx=5)
        exec_frame.columnconfigure(1, weight=1)

        # 批次大小
        ttk.Label(exec_frame, text="批次大小:", width=12, anchor=tk.W).grid(row=0, column=0, sticky=tk.W, pady=5)
        self.batch_size = tk.IntVar(value=120)
        ttk.Spinbox(exec_frame, from_=0, to=1000, textvariable=self.batch_size, width=15).grid(
            row=0, column=1, sticky=(tk.W, tk.E), pady=5, padx=(5, 0)
        )
        ttk.Label(exec_frame, text="(0=不分批)", font=('', 9)).grid(row=1, column=0, columnspan=2, sticky=tk.W)

        # 等待时间
        ttk.Label(exec_frame, text="等待时间(秒):", width=12, anchor=tk.W).grid(row=2, column=0, sticky=tk.W, pady=5)
        self.wait_time = tk.IntVar(value=4)
        ttk.Spinbox(exec_frame, from_=1, to=60, textvariable=self.wait_time, width=15).grid(
            row=2, column=1, sticky=(tk.W, tk.E), pady=5, padx=(5, 0)
        )

        # 下载线程数
        ttk.Label(exec_frame, text="下载线程数:", width=12, anchor=tk.W).grid(row=3, column=0, sticky=tk.W, pady=5)
        self.download_workers = tk.IntVar(value=8)
        ttk.Spinbox(exec_frame, from_=1, to=20, textvariable=self.download_workers, width=15).grid(
            row=3, column=1, sticky=(tk.W, tk.E), pady=5, padx=(5, 0)
        )

        # ===== 第二列：下载配置 =====
        download_frame = ttk.LabelFrame(config_container, text="下载配置", padding=10)
        download_frame.grid(row=0, column=1, sticky=(tk.W, tk.E, tk.N), padx=5)
        download_frame.columnconfigure(1, weight=1)

        # 下载范围
        ttk.Label(download_frame, text="下载范围:", width=10, anchor=tk.W).grid(row=0, column=0, sticky=tk.W, pady=5)
        self.download_range = tk.StringVar()
        ttk.Entry(download_frame, textvariable=self.download_range, width=15).grid(
            row=0, column=1, sticky=(tk.W, tk.E), pady=5, padx=(5, 0)
        )
        ttk.Label(download_frame, text="(如: 1-50)", font=('', 9)).grid(row=1, column=0, columnspan=2, sticky=tk.W)

        # 单次采集数量
        ttk.Label(download_frame, text="单次采集:", width=10, anchor=tk.W).grid(row=2, column=0, sticky=tk.W, pady=5)
        self.download_chunk_size = tk.IntVar(value=80)
        ttk.Spinbox(download_frame, from_=10, to=200, textvariable=self.download_chunk_size, width=15).grid(
            row=2, column=1, sticky=(tk.W, tk.E), pady=5, padx=(5, 0)
        )

        # Flow URL
        ttk.Label(download_frame, text="Flow URL:", width=10, anchor=tk.W).grid(row=3, column=0, sticky=tk.W, pady=5)
        self.flow_url = tk.StringVar()
        ttk.Entry(download_frame, textvariable=self.flow_url, width=15).grid(
            row=3, column=1, sticky=(tk.W, tk.E), pady=5, padx=(5, 0)
        )

        # ===== 第三列：运行选项 =====
        options_frame = ttk.LabelFrame(config_container, text="运行选项", padding=10)
        options_frame.grid(row=0, column=2, sticky=(tk.W, tk.E, tk.N), padx=5)

        self.show_browser = tk.BooleanVar(value=False)
        ttk.Checkbutton(options_frame, text="显示浏览器", variable=self.show_browser).grid(
            row=0, column=0, sticky=tk.W, pady=5
        )

        self.download_only = tk.BooleanVar(value=False)
        ttk.Checkbutton(options_frame, text="仅下载模式", variable=self.download_only).grid(
            row=1, column=0, sticky=tk.W, pady=5
        )

        self.force_new_project = tk.BooleanVar(value=False)
        ttk.Checkbutton(options_frame, text="强制新项目", variable=self.force_new_project).grid(
            row=2, column=0, sticky=tk.W, pady=5
        )

        self.auto_confirm = tk.BooleanVar(value=True)
        ttk.Checkbutton(options_frame, text="自动确认", variable=self.auto_confirm).grid(
            row=3, column=0, sticky=tk.W, pady=5
        )

        current_row += 1

        # ===== 按钮区域 =====
        ttk.Separator(main_frame, orient='horizontal').grid(
            row=current_row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=15
        )
        current_row += 1

        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=current_row, column=0, columnspan=3, pady=10)

        self.start_button = ttk.Button(button_frame, text="开始执行", command=self.start_execution, width=15)
        self.start_button.pack(side=tk.LEFT, padx=5)

        self.stop_button = ttk.Button(button_frame, text="停止执行", command=self.stop_execution,
                                       width=15, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT, padx=5)

        ttk.Button(button_frame, text="清空日志", command=self.clear_log, width=15).pack(side=tk.LEFT, padx=5)

        current_row += 1

        # ===== 日志输出区域 =====
        ttk.Label(main_frame, text="执行日志:", font=('', 10, 'bold')).grid(
            row=current_row, column=0, columnspan=3, sticky=tk.W, pady=(10, 5)
        )
        current_row += 1

        # 日志文本框
        log_frame = ttk.Frame(main_frame)
        log_frame.grid(row=current_row, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        main_frame.rowconfigure(current_row, weight=1)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=25, wrap=tk.WORD,
                                                   font=('Courier', 9))
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # 添加一些内边距
        for child in main_frame.winfo_children():
            child.grid_configure(padx=5)

        # 加载上次保存的配置
        self.load_config()

    def browse_prompts_file(self):
        """浏览选择提示词文件"""
        filename = filedialog.askopenfilename(
            title="选择提示词文件",
            filetypes=[
                ("Text files", "*.txt"),
                ("JSON files", "*.json"),
                ("All files", "*.*")
            ]
        )
        if filename:
            self.prompts_file.set(filename)

    def browse_download_dir(self):
        """浏览选择下载目录"""
        directory = filedialog.askdirectory(title="选择下载目录")
        if directory:
            self.download_dir.set(directory)

    def build_command(self):
        """构建命令行参数"""
        cmd = [sys.executable, "main.py"]

        # 基础参数
        if self.prompts_file.get():
            cmd.extend(["--prompts", self.prompts_file.get()])

        if self.profile_id.get():
            cmd.extend(["--profile-id", self.profile_id.get()])

        if self.download_dir.get():
            cmd.extend(["--download-dir", self.download_dir.get()])

        # 数值参数
        cmd.extend(["--batch-size", str(self.batch_size.get())])
        cmd.extend(["--wait-time", str(self.wait_time.get())])
        cmd.extend(["--download-workers", str(self.download_workers.get())])
        cmd.extend(["--download-chunk-size", str(self.download_chunk_size.get())])

        # 可选参数
        if self.download_range.get():
            cmd.extend(["--download-range", self.download_range.get()])

        if self.flow_url.get():
            cmd.extend(["--flow-url", self.flow_url.get()])

        # 布尔选项
        if self.show_browser.get():
            cmd.append("--show-browser")

        if self.download_only.get():
            cmd.append("--download-only")

        if self.force_new_project.get():
            cmd.append("--force-new-project")

        if self.auto_confirm.get():
            cmd.append("--yes")

        return cmd

    def log(self, message):
        """添加日志消息（线程安全）"""
        def _log():
            self.log_text.insert(tk.END, message + "\n")
            self.log_text.see(tk.END)

        # 使用 after 确保在主线程中更新 GUI
        self.root.after(0, _log)

    def clear_log(self):
        """清空日志"""
        self.log_text.delete(1.0, tk.END)

    def start_execution(self):
        """开始执行"""
        # 验证必填项
        if not self.download_only.get() and not self.prompts_file.get():
            messagebox.showerror("错误", "请选择提示词文件或启用仅下载模式")
            return

        if self.prompts_file.get() and not os.path.exists(self.prompts_file.get()):
            messagebox.showerror("错误", f"提示词文件不存在: {self.prompts_file.get()}")
            return

        # 保存当前配置
        self.save_config()

        # 构建命令
        cmd = self.build_command()

        # 显示命令
        self.log("=" * 60)
        self.log("执行命令:")
        self.log(" ".join(cmd))
        self.log("=" * 60)

        # 更新按钮状态
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.is_running = True

        # 在新线程中执行
        thread = threading.Thread(target=self.run_process, args=(cmd,))
        thread.daemon = True
        thread.start()

    def run_process(self, cmd):
        """在子进程中运行命令"""
        try:
            # 使用 Popen 以便实时读取输出
            # 设置环境变量禁用输出缓冲
            env = os.environ.copy()
            env['PYTHONUNBUFFERED'] = '1'

            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=0,  # 无缓冲
                universal_newlines=True,
                env=env
            )

            # 实时读取输出
            while True:
                if not self.is_running:
                    break

                line = self.process.stdout.readline()
                if not line:
                    # 检查进程是否结束
                    if self.process.poll() is not None:
                        break
                    continue

                self.log(line.rstrip())

            self.process.wait()

            if self.is_running:
                if self.process.returncode == 0:
                    self.log("\n" + "=" * 60)
                    self.log("✓ 执行完成！")
                    self.log("=" * 60)
                    self.root.after(0, lambda: messagebox.showinfo("完成", "任务执行完成！"))
                else:
                    self.log("\n" + "=" * 60)
                    self.log(f"✗ 执行失败，退出码: {self.process.returncode}")
                    self.log("=" * 60)
                    self.root.after(0, lambda: messagebox.showerror("错误", f"执行失败，退出码: {self.process.returncode}"))

        except Exception as e:
            self.log(f"\n✗ 执行出错: {e}")
            import traceback
            self.log(traceback.format_exc())
            self.root.after(0, lambda: messagebox.showerror("错误", f"执行出错: {e}"))

        finally:
            self.is_running = False
            self.root.after(0, lambda: self.start_button.config(state=tk.NORMAL))
            self.root.after(0, lambda: self.stop_button.config(state=tk.DISABLED))

    def stop_execution(self):
        """停止执行"""
        if self.process and self.is_running:
            try:
                self.is_running = False
                self.process.terminate()
                self.log("\n✗ 用户停止执行")
                messagebox.showinfo("已停止", "任务已停止")
            except Exception as e:
                self.log(f"\n✗ 停止失败: {e}")
                messagebox.showerror("错误", f"停止失败: {e}")

    def save_config(self):
        """保存当前配置到文件"""
        config = {
            "prompts_file": self.prompts_file.get(),
            "profile_id": self.profile_id.get(),
            "download_dir": self.download_dir.get(),
            "batch_size": self.batch_size.get(),
            "wait_time": self.wait_time.get(),
            "download_workers": self.download_workers.get(),
            "download_range": self.download_range.get(),
            "download_chunk_size": self.download_chunk_size.get(),
            "flow_url": self.flow_url.get(),
            "show_browser": self.show_browser.get(),
            "download_only": self.download_only.get(),
            "force_new_project": self.force_new_project.get(),
            "auto_confirm": self.auto_confirm.get(),
        }

        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"保存配置失败: {e}")

    def load_config(self):
        """从文件加载配置"""
        if not os.path.exists(self.config_file):
            return

        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)

            # 恢复配置
            self.prompts_file.set(config.get("prompts_file", ""))
            self.profile_id.set(config.get("profile_id", "kpcl6vt"))
            self.download_dir.set(config.get("download_dir", "/Users/zzf/youtube/baby长视频素材/new"))
            self.batch_size.set(config.get("batch_size", 120))
            self.wait_time.set(config.get("wait_time", 4))
            self.download_workers.set(config.get("download_workers", 8))
            self.download_range.set(config.get("download_range", ""))
            self.download_chunk_size.set(config.get("download_chunk_size", 80))
            self.flow_url.set(config.get("flow_url", ""))
            self.show_browser.set(config.get("show_browser", False))
            self.download_only.set(config.get("download_only", False))
            self.force_new_project.set(config.get("force_new_project", False))
            self.auto_confirm.set(config.get("auto_confirm", True))

        except Exception as e:
            print(f"加载配置失败: {e}")


def main():
    """主程序入口"""
    root = tk.Tk()
    app = FlowGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
