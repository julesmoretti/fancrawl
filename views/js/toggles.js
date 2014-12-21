/**
 * Calculate incremental amounts of pixels scrolled in each axis.
 * Value is signed to its direction.
 */

function incrementalScroll(e) {

    var scrollX = (this.x || window.pageXOffset) - window.pageXOffset;
    var scrollY = (this.y || window.pageYOffset) - window.pageYOffset;

    this.x = window.pageXOffset;
    this.y = window.pageYOffset;

    direction(scrollX, scrollY);
}

function direction(scrollX, scrollY){

    var directionX = !scrollX ? "NONE" : scrollX>0 ? "LEFT" : "RIGHT";
    var directionY = !scrollY ? "NONE" : scrollY>0 ? "UP" : "DOWN";
    var diff = window.screen.availHeight - window.pageYOffset - 36;

    if ( directionY === "UP" ) {
        d3.selectAll(".header")
          .transition()
          .duration(100)
          .style("top", 0+"px");
      if ( diff > 30 ) {
        d3.selectAll(".status_bar")
          .transition()
          .duration(100)
          .style("bottom", -30+"px");
      } else if ( diff < 0 ) {
        d3.selectAll(".status_bar")
          .style("bottom", 0+"px");
      } else {
        d3.selectAll(".status_bar")
          .style("bottom", "-"+diff+"px");
      }

    } else if ( directionY === "DOWN" ) {

      if ( window.pageYOffset > 44 ) {
        d3.selectAll(".header")
          .transition()
          .duration(100)
          .style("top", -44+"px");
      } else if ( window.pageYOffset < 0 ) {
        d3.selectAll(".header")
          .style("top", 0+"px");
      } else {
        d3.selectAll(".header")
          .style("top", "-"+window.pageYOffset+"px");
      }

      d3.selectAll(".status_bar")
        .transition()
        .duration(100)
        .style("bottom", 0+"px");

    }
}

window.onscroll = incrementalScroll;

var logOut = function(){
  $.ajax( {url: "https://instagram.com/accounts/logout", dataType: 'jsonp' } )
    .done(function() {
      console.log( "success" );
      window.location.replace("/");
    })
    .fail(function(e) {
      console.log('Error::' + e.responseText);
      window.location.replace("/");
    })
    .always(function() {
      console.log( "complete" );
    });
}

var toggleAttributes1 = function() {

  $('#hidden').removeClass('show');

  // tobbles other tab
  var switch2 = document.getElementById("switch2");
  var disabled = switch2.getAttribute("disabled");

  if ( disabled === 'disabled' ) {
    switch2.removeAttribute("disabled");
    document.getElementById("switch2label").removeAttribute("class");
  } else {
    switch2.setAttribute("disabled", "disabled");
    document.getElementById("switch2label").setAttribute("class", "muted");
  }

  // toggles save button
  var submitButton = document.getElementById("submitButton");
  var subDisabled = submitButton.getAttribute("disabled");
  if ( subDisabled !== null || subDisabled === 'disabled' ) {
    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton ";
  } else {
    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";
  }

};

var toggleAttributes2 = function() {

  $('#hidden').removeClass('show');

  // tobbles other tab
  var switch1 = document.getElementById("switch1");
  var disabled = switch1.getAttribute("disabled");

  if ( disabled === 'disabled' ) {
    switch1.removeAttribute("disabled");
    document.getElementById("switch1label").removeAttribute("class");
  } else {
    switch1.setAttribute("disabled", "disabled");
    document.getElementById("switch1label").setAttribute("class", "muted");
  }

  // toggles save button
  var submitButton = document.getElementById("submitButton");
  var subDisabled = submitButton.getAttribute("disabled");
  if ( subDisabled !== null || subDisabled === 'disabled' ) {
    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton ";
  } else {
    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";
  }
};

var toggleAttributes3 = function() {

  $('#hidden').removeClass('show');

  // toggles save button
  var submitButton = document.getElementById("submitButton");
  var subDisabled = submitButton.getAttribute("disabled");
  var eMail = document.getElementById("eMail");
  var value = eMail.getAttribute("value");
  var input = eMail.value;

  if ( value !== input ) {
    // do nothing on change
  } else if ( subDisabled !== null || subDisabled === 'disabled' ) {
    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton ";
  } else {
    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";
  }
};

var eMailChangeVerification = function() {
  var eMail = document.getElementById("eMail");
  var value = eMail.getAttribute("value");
  var input = eMail.value;

  if ( value !== input ) {
    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton ";
  } else {
    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";
  }
}
