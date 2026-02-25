import os
from pathlib import Path
from PySide6.QtWidgets import QDockWidget, QListWidget, QListWidgetItem
from PySide6.QtGui import QPixmap, QIcon
from PySide6.QtCore import Qt, QSize
from algorithms.img2Colors import ColorAnalysis


class Timeline(QDockWidget):
    def __init__(self, parent, colorC):
        super().__init__('Timeline/Storyboard', parent)
        self.parent = parent
        self.colorc = colorC
        # Resolve project root (three levels up from this file)
        self.project_root = os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))))
        self.init_ui()

        self.parent.filename_changed.connect(self.on_filename_changed)
        self.parent.shot_finished.connect(self.on_shot_finished)

    def init_ui(self):
        self.listWidget = QListWidget(self)
        self.listWidget.setViewMode(QListWidget.IconMode)
        self.listWidget.setResizeMode(QListWidget.Adjust)
        self.listWidget.setFlow(QListWidget.LeftToRight)
        self.listWidget.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.listWidget.setWrapping(True)
        self.listWidget.setIconSize(QSize(100, 67))
        self.listWidget.itemSelectionChanged.connect(self.video_play)
        self.setWidget(self.listWidget)

        self.currentImgIdx = 0
        self.currentImg = None
        self.paths = []

    def showShot(self, name):
        self.listWidget.clear()
        self.paths = []

        if name is None or name == '':
            return

        # Build absolute frame directory
        frame_dir = os.path.join(self.project_root, 'img', name, 'frame')

        try:
            self.imglist = os.listdir(frame_dir)
        except Exception as e:  # noqa
            print(f"Error reading directory 'img/{name}': {e}")
            return

        if self.imglist:
            for img in self.imglist:
                img_path = os.path.join(frame_dir, img)
                pixmap = QPixmap(img_path)
                self.paths.append(img_path)
                item = QListWidgetItem(QIcon(pixmap), '')
                self.listWidget.addItem(item)
            self.listWidget.itemDoubleClicked.connect(self.draw_pie)

    def on_filename_changed(self, filename):
        self.listWidget.clear()
        if filename is None or filename == '':
            return
        self.showShot(Path(filename).resolve().stem)

    def on_shot_finished(self):
        self.on_filename_changed(self.parent.filename)

    def video_play(self):
        self.currentImgIdx = self.listWidget.currentIndex().row()
        if self.currentImgIdx in range(len(self.imglist)):
            frameId = int(self.imglist[self.currentImgIdx][5:-4])
            self.parent.video_play_changed.emit(frameId)

    def draw_pie(self):
        imageid = self.listWidget.currentRow()
        imgpath = self.paths[imageid]
        analysis = ColorAnalysis("")
        analysis.analysis1img(imgpath, self.colorc)
        # Save/load colortmp.png next to the video's img/<name> folder
        save_dir = os.path.dirname(os.path.dirname(imgpath))  # .../img/<name>
        path = os.path.join(save_dir, 'colortmp.png')
        piximg = QPixmap(path)
        piximg = piximg.scaled(250, 160)
        self.parent.control.AnalyzeImgPath = path
        self.parent.analyze.labelAnalyze.setPixmap(piximg)
