// LOGIN PAGE
d3.selectAll(".lens span")
    .style("opacity", 0)
    .transition()
    .duration(1000)
    .delay(2500)
    .style("opacity", 0.5);

// footer
d3.selectAll(".description")
    .style("bottom", -30+"px")
    .transition()
    .duration(2000)
    .delay(0)
    .style("bottom", 10+"px");

// get circles to change sizes
d3.selectAll("circle")
    .style("stroke-width", function(d, i){
      var width = Math.floor(((Math.random() * 4) + 2) * 100) / 100;
      return width;
    })
  .transition()
    .duration(function(){
      var delay = Math.floor(Math.random() * 1000) * 5;
      return delay;
    })
    .delay(function(){
      var delay = Math.floor(Math.random() * 1000) * 5;
      return delay;
    })
    .style("stroke-width", function(d, i){
      var width = Math.floor(((Math.random() * 4) + 2) * 100) / 100;
      return width;
    });

// get lines to change color
d3.selectAll("line, polyline")
    .style("stroke-width", function(){
      var width = (Math.floor(Math.random() * 200) / 100) + 2;
      return width;
    })
    .style("stroke", function(){
      var color = Math.floor(Math.random() * 100) + 50;
      return "rgb("+color+","+color+","+color+")";
    })
  .transition()
    .duration(function(){
      var delay = Math.floor(Math.random() * 1000) * 5;
      return delay;
    })
    .delay(function(){
      var delay = Math.floor(Math.random() * 1000) * 5;
      return delay;
    })
    .style("stroke-width", function(d, i){
      var width = (Math.floor(Math.random() * 200) / 100) + 2;
      return width;
    })
    .style("stroke", function(){
      var color = Math.floor(Math.random() * 100) + 50;
      return "rgb("+color+","+color+","+color+")";
    });
