// LOGIN PAGE
d3.selectAll(".lens span")
    .style("opacity", 0)
    .transition()
    .duration(1000)
    .delay(500)
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
    .style("stroke", "rgb(25,21,10)")
    .style("fill", "rgb(25,21,10)")
  .transition()
    .duration(function(){
      var duration = ( Math.floor(Math.random() * 1000) * 3 ) + 500;
      return duration;
    })
    .delay(1000)
    .style("stroke", "rgb(225,221,210)" )
    .style("fill", "rgb(225,221,210)" )
    .delay(function(){
      var delay = ( Math.floor(Math.random() * 1000) * 3 ) + 0;
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
      var duration = (Math.floor(Math.random() * 1000 ) * 3) + 1000;
      return duration;
    })
    .delay(function(){
      var delay = (Math.floor(Math.random() * 1000 ) * 2) + 500;
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
