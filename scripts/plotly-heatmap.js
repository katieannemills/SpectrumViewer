function plotly_hm(div){
    this.div = div;

    this.draw = function(z){
        const data = [{
            z: z,
            type: 'heatmap',
            colorscale: 'Viridis',
            hoverongaps: false
        }];

        const layout = {
            title: 'demo',
        };

        Plotly.newPlot(this.div, data, layout);
    }
}