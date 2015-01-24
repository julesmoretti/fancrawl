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

var toggleAttributesFanCrawl = function() {

  $('#hidden').removeClass('show');

  // tobbles other tab
  var switchClean = document.getElementById("switchClean");
  var disabled = switchClean.getAttribute("disabled");

  if ( disabled === 'disabled' ) {
    switchClean.removeAttribute("disabled");
    document.getElementById("switchCleanlabel").removeAttribute("class");
  } else {
    switchClean.setAttribute("disabled", "disabled");
    document.getElementById("switchCleanlabel").setAttribute("class", "muted");
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

var toggleAttributesClean = function() {

  $('#hidden').removeClass('show');

  // tobbles other tab
  var switchFanCrawl = document.getElementById("switchFanCrawl");
  var disabled = switchFanCrawl.getAttribute("disabled");

  if ( disabled === 'disabled' ) {
    switchFanCrawl.removeAttribute("disabled");
    document.getElementById("switchFanCrawllabel").removeAttribute("class");
  } else {
    switchFanCrawl.setAttribute("disabled", "disabled");
    document.getElementById("switchFanCrawllabel").setAttribute("class", "muted");
  }

  // toggles save button
  var submitButton = document.getElementById("submitButton");
  var subDisabled = submitButton.getAttribute("disabled");

  if ( subDisabled !== null || subDisabled === 'disabled' ) {
    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton";
  } else {
    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";
  }
};

var toggleAttributesEmailNoti = function() {

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

var toggleAttributesMasterNoti = function() {

  $('#hidden').removeClass('show');

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

var toggleAttributesHash = function() {

  $('#hidden').removeClass('show');

  // toggles save button
  var submitButton = document.getElementById("submitButton");
  var subDisabled = submitButton.getAttribute("disabled");
  var hash = document.getElementById("hash");
  var value = hash.getAttribute("value");
  var input = hash.value;

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

var hashChangeVerification  = function() {
  var submitButton          = document.getElementById("submitButton");

  var hash                  = document.getElementById("hash");
  var original              = hash.getAttribute("class");            // either empty, selected or deselected
  var value                 = hash.getAttribute("value");            // original saved hash
  var input                 = hash.value;                            // user input field

  var switchHashLabel       = document.getElementById("switchHashlabel");

  var switchHash            = document.getElementById("switchHash");
  var disabled              = switchHash.getAttribute("disabled");
  var checkbox              = switchHash.getAttribute("checkd");

  console.log( switchHash );
  console.log( switchHashlabel );

  if ( disabled === 'disabled' && value !== input ) {
    switchHash.removeAttribute("disabled");
    document.getElementById("switchHashlabel").removeAttribute("class");

    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton ";

  } else if ( value === input ) {
    switchHash.setAttribute("disabled", "disabled");
    document.getElementById("switchHashlabel").setAttribute("class", "muted");

    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";

    if ( checkbox === "checked" ) {
      // switchHash.setAttribute("checked", "empty");
      document.getElementById("switchHashlabel").setAttribute("class", "switchDivClosed");
    }

  }


  // // when nothing in the input field
  // if ( original === "empty" && input.length === 0  ) {
  //   // make sure that check box is grayed out and disabled...

  // // when something new entered the input field from before
  // } else if ( value !== input && original === "something" ) {
  //   //
  //   submitButton.removeAttribute("disabled");
  //   document.getElementById("submitButton").className = "saveButton ";
  // } else {
  //   submitButton.setAttribute("disabled", "disabled");
  //   document.getElementById("submitButton").className = "saveButton disabledButton";
  // }
}
