function plotly_hm(div){
    this.div = div;
    this.polyX = [];
    this.polyY = [];
    this.lastZ = null;
    this.shiftDown = false;

    // Track shift key - plotly_click event does not provide shift key state :(
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') this.shiftDown = true;
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') this.shiftDown = false;
    });

    this.draw = (z) => {
        this.lastZ = z

        const data = {
            z: z,
            type: 'heatmap',
            colorscale: 'Viridis',
            hoverongaps: false
        };

        const layout = {
            title: 'demo',
        };

        // close polygon where applicable
        let polyX = [...this.polyX];
        let polyY = [...this.polyY];
        if (polyX.length >= 3) {
            polyX.push(polyX[0]);
            polyY.push(polyY[0]);
        }

        const polygon = {
            x: polyX,
            y: polyY,
            mode: 'lines',
            line: { color: 'white' },
            type: 'scatter',
            name: 'Polygon',
            showlegend: false
        };

        Plotly.newPlot(this.div, [data, polygon], layout).then(() => {
                document.getElementById(this.div).on('plotly_click', (event) => {
                    if (!this.shiftDown) return;

                    const pt = event.points[0];
                    this.polyX.push(pt.x);
                    this.polyY.push(pt.y);

                    this.draw(this.lastZ);
                });
                this.eventsBound = true;
        });
    }
}