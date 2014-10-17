// DASHBOARD

// warning errors
  d3.selectAll('.warnings')
    .style("top", -300+"px")
    .transition()
    .delay(500)
    .duration(2000)
    .style("top", 54+"px");

var closeWarning = function(){
  console.log("closing box");

  d3.selectAll('.warnings')
    .style("opacity", 1)
    .transition()
    .delay(200)
    .duration(500)
    .style("opacity", 0);
};

// header
d3.selectAll(".header")
    .style("top", -44+"px")
    .transition()
    .duration(1000)
    .style("top", 0+"px");

// logo
d3.selectAll(".headerInner span")
    .style("margin-left", -500+"px")
    .transition()
    .delay(1000)
    .duration(500)
    .style("margin-left", 8+"px");

// user menu
d3.selectAll(".user")
    .style("right", -500+"px")
    .transition()
    .delay(1000)
    .duration(500)
    .style("right", 5+"px");

d3.selectAll(".user span")
    .style("opacity", 0)
    .transition()
    .delay(1500)
    .duration(500)
    .style("opacity", 1);

// footer
d3.selectAll(".status_bar")
    .style("bottom", -30+"px")
    .transition()
    .duration(1000)
    .delay(600)
    .style("bottom", 0+"px");

// blue zone
d3.selectAll(".banner")
    .style("height", 0+"px")
    .transition()
    .duration(500)
    .delay(0)
    .style("height", 200+"px");

// title
d3.selectAll(".banner .bannerInner span")
    .style("opacity", 0)
    .transition()
    .duration(2000)
    .delay(2000)
    .style("opacity", 1);

d3.selectAll(".mainStats")
              .style("opacity", 0)
              .style("width", 0+"%")
              .transition()
              .duration(1000)
              .delay(function(d, i){
                var time = ( i * 100 ) + 200;
                return time;
              })
              .style("width", 100+"%")
              .style("opacity", 1);

d3.selectAll(".mainControllers")
              .style("opacity", 0)
              .style("width", "calc("+0+"% - 16px)")
              .transition()
              .duration(1000)
              .delay(500)
              .style("opacity", 1)
              .style("width", "calc("+100+"% - 16px)")
