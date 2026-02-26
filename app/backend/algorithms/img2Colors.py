import os
from collections import Counter
from PIL import Image
import numpy as np
from matplotlib import pyplot as plt
from scipy.cluster.vq import vq, kmeans
import math
from .resultsave import resultsave


class ColorAnalysis:
    def __init__(self, filename):
        self.filename = filename

    def load_image(self):
        img = Image.open(self.filename)
        img = img.rotate(-90)
        img.thumbnail((200, 200))
        w, h = img.size
        points = []
        for count, color in img.getcolors(w * h):
            points.append(color)
        return points

    def kmeans(self, imgdata, n):
        data = np.array(imgdata, dtype=float)
        centers, loss = kmeans(data, n)
        centers = np.array(centers, dtype=int)
        return centers

    def calculate_distances(self, centers):
        imgdata = self.load_image()
        result = []
        for one_center in centers:
            dis = math.sqrt(one_center[0] ** 2 +
                            one_center[1] ** 2 + one_center[2] ** 2)
            flag = -1
            for index, one_color in enumerate(imgdata):
                temp = math.sqrt((one_color[0] - one_center[0]) ** 2 + (one_color[1] - one_center[1]) ** 2 + (
                    one_color[2] - one_center[2]) ** 2)
                if temp < dis:
                    dis = temp
                    flag = index
            result.append(list(imgdata[flag]))
        return result

    def rgb_to_hex(self, real_color):
        colors_16 = []
        for one_color in real_color:
            color_16 = '#'
            for one in one_color:
                color_16 += str(hex(one))[-2:].replace('x', '0').upper()
            colors_16.append(color_16)
        return colors_16

    def normalize_color_count(self, realcolor, target_count):
        if target_count <= 0:
            return []
        if not realcolor:
            return [[0, 0, 0] for _ in range(target_count)]
        if len(realcolor) >= target_count:
            return realcolor[:target_count]
        return realcolor + [list(realcolor[0]) for _ in range(target_count - len(realcolor))]

    def imgColors(self, imgpath, colorsC):
        # Build the correct path to the frame directory using absolute path
        project_root = os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))))
        frame_dir = os.path.join(project_root, "img", imgpath, "frame")

        print(f"[img2Colors] Looking for frame directory: {frame_dir}")

        # Check if the directory exists
        if not os.path.exists(frame_dir):
            print(f"[img2Colors] Frame directory not found: {frame_dir}")
            print(f"[img2Colors] Current working directory: {os.getcwd()}")
            print(f"[img2Colors] Available directories in img/:")
            img_dir = os.path.join(project_root, "img")
            if os.path.exists(img_dir):
                print(f"[img2Colors] Contents of img/: {os.listdir(img_dir)}")
                if os.path.exists(os.path.join(img_dir, imgpath)):
                    print(
                        f"[img2Colors] Contents of img/{imgpath}/: {os.listdir(os.path.join(img_dir, imgpath))}")
            raise FileNotFoundError(
                f"Frame directory not found: {frame_dir}. Please run shot detection first to generate frames.")

        imglist = os.listdir(frame_dir)
        colorlist = []
        allrealcolors = []
        allcolors = []
        allcolor_16 = []

        for i in imglist:
            self.filename = os.path.join(frame_dir, i)
            imgdata = self.load_image()
            if not imgdata:
                realcolor = [[0, 0, 0] for _ in range(colorsC)]
            else:
                cluster_count = min(colorsC, len(imgdata))
                colors = self.kmeans(imgdata, cluster_count)  # 提取几种色彩
                realcolor = self.calculate_distances(colors)
                realcolor = self.normalize_color_count(realcolor, colorsC)
            color_16 = self.rgb_to_hex(realcolor)
            allcolor_16 += color_16
            allrealcolors += realcolor
            allcolors.append((list)(realcolor))  # 用于plot3D
            flat_colors = np.array(realcolor, dtype=int).reshape(-1)
            target_len = 3 * colorsC
            if flat_colors.size < target_len:
                flat_colors = np.pad(
                    flat_colors, (0, target_len - flat_colors.size), mode='constant'
                )
            elif flat_colors.size > target_len:
                flat_colors = flat_colors[:target_len]
            colorlist.append([i, flat_colors])

        # Use absolute path for the save directory
        save_dir = os.path.join(project_root, "img", imgpath)
        rs = resultsave(save_dir + "/")
        rs.color_csv(colorlist)
        rs.plot_scatter_3d(allcolors)

    def analysis1img(self, imgpath, colorC):
        self.filename = imgpath
        imgdata = self.load_image()
        if not imgdata:
            realcolor = [[0, 0, 0] for _ in range(colorC)]
        else:
            cluster_count = min(colorC, len(imgdata))
            colors = self.kmeans(imgdata, cluster_count)  # 提取几种色彩
            realcolor = self.calculate_distances(colors)
            realcolor = self.normalize_color_count(realcolor, colorC)
        color_16 = self.rgb_to_hex(realcolor)
        self.drawpie(imgdata, realcolor, color_16)

    def drawpie(self, imgdata, colors, colors_16):
        cluster1, _ = vq(imgdata, colors)
        result = Counter(cluster1.tolist())
        sizes = [result.get(idx, 0) for idx in range(len(colors))]
        plt.style.use("dark_background")
        plt.pie(x=sizes,  # 指定绘图数据
                colors=colors_16,  # 为饼图添加标签说明
                wedgeprops=dict(width=0.2, edgecolor='w'),  # 设置环图
                labels=colors_16,
                autopct='%1.2f%%',
                )
        plt.savefig('/'.join(self.filename.split("/")[:2]) + '/colortmp.png')
        # plt.show()
