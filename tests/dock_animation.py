import tkinter as tk
import math
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

class FisheyeDockSandbox:
    def __init__(self, root):
        self.root = root
        self.root.title("Fisheye Proximity Math Monitor")
        self.root.geometry("700x500")
        self.root.configure(bg="#0b0f19")

        # --- ALGORITHM CONTROLS ---
        self.RADIUS = 150        # Range of mouse influence (pixels)
        self.MAX_SCALE = 2.4     # Maximum magnification multiplier
        self.BASE_SIZE = 40      # Base dimension of an icon (pixels)
        self.BASE_PADDING = 8    # Default margin separation (pixels)

        # Mock icon labels for tracking coordinates
        self.icon_labels = ["📁", "🌐", "💬", "🎵", "📸", "⚙️"]
        self.num_icons = len(self.icon_labels)

        # --- GRAPH VISUALIZER SETUP ---
        # Initialize Matplotlib Figure to mirror the bell curve calculations
        self.fig = Figure(figsize=(6, 2), dpi=100, facecolor="#0b0f19")
        self.ax = self.fig.add_subplot(111)
        self.ax.set_facecolor("#111827")
        self.ax.tick_params(colors="#9ca3af", labelsize=8)
        self.ax.spines['bottom'].set_color('#1f2937')
        self.ax.spines['top'].set_visible(False)
        self.ax.spines['right'].set_visible(False)
        self.ax.spines['left'].set_color('#1f2937')
        
        # Embed the matplotlib drawing canvas inside the Tkinter framework hierarchy
        self.graph_canvas = FigureCanvasTkAgg(self.fig, master=self.root)
        self.graph_canvas.get_tk_widget().pack(fill=tk.X, padx=20, pady=20)

        # --- METRICS DISPLAY PANELS ---
        self.metrics_frame = tk.Frame(self.root, bg="#0b0f19")
        self.metrics_frame.pack(fill=tk.X, padx=20, pady=10)
        
        self.proximity_lbl = tk.Label(self.metrics_frame, text="Proximity: 0.00", fg="#38bdf8", bg="#111827", font=("Courier", 12, "bold"), width=18, height=2, bd=1, relief="groove")
        self.proximity_lbl.pack(side=tk.LEFT, expand=True, padx=5)
        
        self.scale_lbl = tk.Label(self.metrics_frame, text="Scale: 1.00x", fg="#38bdf8", bg="#111827", font=("Courier", 12, "bold"), width=18, height=2, bd=1, relief="groove")
        self.scale_lbl.pack(side=tk.LEFT, expand=True, padx=5)

        # --- INDUSTRIAL DOCK COMPONENT LAYOUT CONTAINER ---
        self.dock_container = tk.Frame(self.root, bg="rgba(255, 255, 255, 0.08)", height=100)
        self.dock_container.pack(fill=tk.X, side=tk.BOTTOM, padx=40, pady=40)
        self.dock_container.pack_propagate(False) # Keep fixed height uniform

        # Inner canvas used to handle custom item redraw calculations smoothly
        self.dock_canvas = tk.Canvas(self.dock_container, bg="#1e1b4b", highlightthickness=0)
        self.dock_canvas.pack(fill=tk.BOTH, expand=True)

        # Initialize flat array configurations
        self.icon_centers = []
        
        # Trigger frame recalculations bound onto cursor motion updates
        self.root.bind("<Motion>", self.on_mouse_move)
        self.dock_canvas.bind("<Leave>", self.on_mouse_leave)

        # Initial layout render
        self.render_system(None)

    def render_system(self, mouse_x):
        # Clean canvas and prepare bounding calculations
        self.dock_canvas.delete("all")
        canvas_width = self.dock_canvas.winfo_width()
        canvas_height = self.dock_canvas.winfo_height()
        
        if canvas_width <= 1: # Window fallback state safety check
            canvas_width = 620
            canvas_height = 100

        # Precompute positions for items to keep the dock centered layout uniform [US7434177B1]
        scales = [1.0] * self.num_icons
        paddings = [self.BASE_PADDING] * self.num_icons
        
        top_proximity = 0.0
        top_scale = 1.0

        # Step 1: Compute immediate proximity scales independently for each layout index
        if mouse_x is not None:
            # Approximate the total baseline structural span of a resting container
            approx_total_width = (self.num_icons * self.BASE_SIZE) + ((self.num_icons + 1) * self.BASE_PADDING)
            start_x = (canvas_width - approx_total_width) / 2
            
            for i in range(self.num_icons):
                estimated_center_x = start_x + (self.BASE_PADDING * (i + 1)) + (self.BASE_SIZE * i) + (self.BASE_SIZE / 2)
                distance = abs(mouse_x - estimated_center_x)
                
                if distance < self.RADIUS:
                    proximity = 1.0 - (distance / self.RADIUS)
                    scales[i] = 1.0 + (self.MAX_SCALE - 1.0) * proximity
                    paddings[i] = self.BASE_PADDING + (scales[i] - 1.0) * 8
                    
                    if proximity > top_proximity:
                        top_proximity = proximity
                        top_scale = scales[i]

        # Step 2: Compute relative layout shifts sequentially from left to right [US7434177B1]
        total_dynamic_width = sum([self.BASE_SIZE * s for s in scales]) + sum(paddings) + self.BASE_PADDING
        current_x = (canvas_width - total_dynamic_width) / 2

        # Step 3: Draw the dynamic icons to screen space
        for i in range(self.num_icons):
            current_x += paddings[i]
            size = self.BASE_SIZE * scales[i]
            
            # Anchor calculations ensuring items swell upwards from baseline platform floor [US7434177B1]
            y2 = canvas_height - 15
            y1 = y2 - size
            x1 = current_x
            x2 = x1 + size
            
            # Paint background bubble element layers
            self.dock_canvas.create_rectangle(x1, y1, x2, y2, fill="#312e81", outline="#4338ca", width=1, tags="icon_box")
            # Inject textual indicator assets
            self.dock_canvas.create_text((x1+x2)/2, (y1+y2)/2, text=self.icon_labels[i], font=("Arial", int(14 * scales[i])), fill="#ffffff")
            
            current_x += size

        # Update statistical numerical indicators text readout fields
        self.proximity_lbl.config(text=f"Proximity: {top_proximity:.2f}")
        self.scale_lbl.config(text=f"Scale: {top_scale:.2f}x")

        # Step 4: Redraw the Bell Curve analytical performance function chart
        self.plot_curve(mouse_x, canvas_width)

    def plot_curve(self, mouse_x, container_width):
        self.ax.clear()
        self.ax.set_facecolor("#111827")
        self.ax.set_xlim(0, container_width)
        self.ax.set_ylim(0.8, self.MAX_SCALE + 0.2)
        
        # Generate resolution points array mapping the horizontal width domain
        x_vals = list(range(0, int(container_width), 2))
        y_vals = []

        for x in x_vals:
            curve_scale = 1.0
            if mouse_x is not None:
                dist = abs(x - mouse_x)
                if dist < self.RADIUS:
                    prox = 1.0 - (dist / self.RADIUS)
                    curve_scale = 1.0 + (self.MAX_SCALE - 1.0) * prox
            y_vals.append(curve_scale)

        # Render shaded area mappings and profile path lines
        self.ax.plot(x_vals, y_vals, color="#38bdf8", linewidth=2)
        self.ax.fill_between(x_vals, 1.0, y_vals, color="#38bdf8", alpha=0.1)

        # Plot structural vertical tracker intersection intercept indicating cursor position
        if mouse_x is not None:
            self.ax.axvline(x=mouse_x, color="#ef4444", linestyle="--", alpha=0.6)

        self.ax.set_title("Fisheye Proximity Distribution Curve", color="#38bdf8", fontsize=10, loc="left")
        self.fig.tight_layout()
        self.graph_canvas.draw()

    def on_mouse_move(self, event):
        # Convert window tracking pointer global coordinate relative down to dock space boundaries
        canvas_x = event.x - self.dock_container.winfo_x()
        self.render_system(canvas_x)

    def on_mouse_leave(self, event):
        self.render_system(None)

if __name__ == "__main__":
    root = tk.Tk()
    app = FisheyeDockSandbox(root)
    # Give Tkinter windows a frame loop execution buffer window before painting elements
    root.update()
    root.mainloop()
