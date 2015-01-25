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

// SWITCH SETTINGS CHANGE TRACKER
var oriSwitchFanCrawl               = false,
    oriSwitchClean                  = false,
    oriSwitchEmailNoti              = false,
    oriInputEmailNoti               = false,
    oriSwitchHash                   = false,
    oriInputHash                    = false,
    oriSwitchMasterNoti             = false;

// checks for switch change to show or hide the update button
var checkSwitchChange = function(){
  var submitButton = document.getElementById("submitButton");

  if (  oriSwitchFanCrawl ||
        oriSwitchClean ||
        oriSwitchEmailNoti ||
        oriInputEmailNoti ||
        oriSwitchHash ||
        oriInputHash ||
        oriSwitchMasterNoti
      ) {

    // show update button
    submitButton.removeAttribute("disabled");
    document.getElementById("submitButton").className = "saveButton ";
  } else {
    // hide update button
    submitButton.setAttribute("disabled", "disabled");
    document.getElementById("submitButton").className = "saveButton disabledButton";
  }
};

// FanCrawl switch button controller
var toggleAttributesFanCrawl = function() {

  $('#hidden').removeClass('show');

  // toggles clean tab
  var switchClean = document.getElementById("switchClean");
  var disabled = switchClean.getAttribute("disabled");

  if ( disabled === 'disabled' ) {
    switchClean.removeAttribute("disabled");
    document.getElementById("switchCleanlabel").removeAttribute("class");
  } else {
    switchClean.setAttribute("disabled", "disabled");
    document.getElementById("switchCleanlabel").setAttribute("class", "muted");
  }

  // check difference for update button
  if ( oriSwitchFanCrawl ) {
    oriSwitchFanCrawl = false;
  } else {
    oriSwitchFanCrawl = true;
  }
  checkSwitchChange();
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

  // check difference for update button
  if ( oriSwitchClean ) {
    oriSwitchClean = false;
  } else {
    oriSwitchClean = true;
  }
  checkSwitchChange();
};

var toggleAttributesEmailNoti = function() {

  $('#hidden').removeClass('show');

  // check difference for update button
  if ( oriSwitchEmailNoti ) {
    oriSwitchEmailNoti = false;
  } else {
    oriSwitchEmailNoti = true;
  }
  checkSwitchChange();

};

var eMailChangeVerification = function() {

  var eMail = document.getElementById("eMail");
  var value = eMail.getAttribute("value");
  var input = eMail.value;

  var switchEmail           = document.getElementById("switchEmailNoti");
  var disabled              = switchEmail.getAttribute("disabled");
  var checkbox              = switchEmail.checked;

  // nothing in the input to begin with and empty input
  if ( value === "" && input.length === 0 ) {
    oriInputEmailNoti = false;

    // uncheck switch and disable it
    switchEmail.setAttribute("disabled", "disabled");
    document.getElementById("switchEmailNotilabel").setAttribute("class", "muted");
    // switch off switch if previously on
    if ( checkbox === true ) {
      document.getElementById('switchEmailNoti').checked = false;

      // check difference for update button
      if ( oriSwitchEmailNoti ) {
        oriSwitchEmailNoti = false;
      } else {
        oriSwitchEmailNoti = true;
      }
    }

  // nothing in the input to begin with but something in the in input
  } else if ( value === "" && input.length !== 0 ) {
    oriInputEmailNoti = true;

    // show switch
    switchEmail.removeAttribute("disabled");
    document.getElementById("switchEmailNotilabel").removeAttribute("class");

  // something in the input to begin with and matching input
  } else if ( value !== "" && input === value ) {
    oriInputEmailNoti = false;

    // show switch
    switchEmail.removeAttribute("disabled");
    document.getElementById("switchEmailNotilabel").removeAttribute("class");

    // switch on switch if previously dissabled
    if ( checkbox === false ) {
      document.getElementById('switchEmailNoti').checked = true;

      // check difference for update button
      if ( oriSwitchEmailNoti ) {
        oriSwitchEmailNoti = false;
      } else {
        oriSwitchEmailNoti = true;
      }
    }

  // something in the input to begin with and different input but not nothing
  } else if ( value !== "" && input !== value && input.length !== 0) {
    oriInputEmailNoti = true;

    // show switch
    switchEmail.removeAttribute("disabled");
    document.getElementById("switchEmailNotilabel").removeAttribute("class");

    // switch on switch if previously dissabled
    if ( checkbox === false ) {
      document.getElementById('switchEmailNoti').checked = true;

      // check difference for update button
      if ( oriSwitchEmailNoti ) {
        oriSwitchEmailNoti = false;
      } else {
        oriSwitchEmailNoti = true;
      }
    }

  // something in the input to begin with and input empty
  } else if ( value !== "" && input !== value && input.length === 0) {
    oriInputEmailNoti = true;

    // uncheck switch and disable it
    switchEmail.setAttribute("disabled", "disabled");
    document.getElementById("switchEmailNotilabel").setAttribute("class", "muted");

    // switch off switch if previously on
    if ( checkbox === true ) {
      document.getElementById('switchEmailNoti').checked = false;

      // check difference for update button
      if ( oriSwitchEmailNoti ) {
        oriSwitchEmailNoti = false;
      } else {
        oriSwitchEmailNoti = true;
      }
    }
  }

  checkSwitchChange();
}



var toggleAttributesHash = function() {

  $('#hidden').removeClass('show');

  // // toggles save button
    // var submitButton = document.getElementById("submitButton");
    // var subDisabled = submitButton.getAttribute("disabled");
    // var hash = document.getElementById("hash");
    // var value = hash.getAttribute("value");
    // var input = hash.value;

    // if ( value !== input ) {
    //   // do nothing on change
    // } else if ( subDisabled !== null || subDisabled === 'disabled' ) {
    //   submitButton.removeAttribute("disabled");
    //   document.getElementById("submitButton").className = "saveButton ";
    // } else {
    //   submitButton.setAttribute("disabled", "disabled");
    //   document.getElementById("submitButton").className = "saveButton disabledButton";
    // }

  // check difference for update button
  if ( oriSwitchHash ) {
    oriSwitchHash = false;
  } else {
    oriSwitchHash = true;
  }
  checkSwitchChange();

};


var hashChangeVerification  = function() {

  var hash                  = document.getElementById("hash");
  var value                 = hash.getAttribute("value");            // original saved hash
  var input                 = hash.value;                            // user input field

  var switchHash            = document.getElementById("switchHash");
  var disabled              = switchHash.getAttribute("disabled");
  var checkbox              = switchHash.checked;

  // nothing in the input to begin with and empty input
  if ( value === "" && input.length === 0 ) {
    oriInputHash = false;

    // uncheck switch and disable it
    switchHash.setAttribute("disabled", "disabled");
    document.getElementById("switchHashlabel").setAttribute("class", "muted");
    // switch off switch if previously on
    if ( checkbox === true ) {
      document.getElementById('switchHash').checked = false;

      // check difference for update button
      if ( oriSwitchHash ) {
        oriSwitchHash = false;
      } else {
        oriSwitchHash = true;
      }
    }

  // nothing in the input to begin with but something in the in input
  } else if ( value === "" && input.length !== 0 ) {
    oriInputHash = true;

    // show switch
    switchHash.removeAttribute("disabled");
    document.getElementById("switchHashlabel").removeAttribute("class");

  // something in the input to begin with and matching input
  } else if ( value !== "" && input === value ) {
    oriInputHash = false;

    // show switch
    switchHash.removeAttribute("disabled");
    document.getElementById("switchHashlabel").removeAttribute("class");

    // switch on switch if previously dissabled
    if ( checkbox === false ) {
      document.getElementById('switchHash').checked = true;

      // check difference for update button
      if ( oriSwitchHash ) {
        oriSwitchHash = false;
      } else {
        oriSwitchHash = true;
      }
    }

  // something in the input to begin with and different input but not nothing
  } else if ( value !== "" && input !== value && input.length !== 0) {
    oriInputHash = true;

    // show switch
    switchHash.removeAttribute("disabled");
    document.getElementById("switchHashlabel").removeAttribute("class");

    // switch on switch if previously dissabled
    if ( checkbox === false ) {
      document.getElementById('switchHash').checked = true;

      // check difference for update button
      if ( oriSwitchHash ) {
        oriSwitchHash = false;
      } else {
        oriSwitchHash = true;
      }
    }

  // something in the input to begin with and input empty
  } else if ( value !== "" && input !== value && input.length === 0) {
    oriInputHash = true;

    // uncheck switch and disable it
    switchHash.setAttribute("disabled", "disabled");
    document.getElementById("switchHashlabel").setAttribute("class", "muted");

    // switch off switch if previously on
    if ( checkbox === true ) {
      document.getElementById('switchHash').checked = false;

      // check difference for update button
      if ( oriSwitchHash ) {
        oriSwitchHash = false;
      } else {
        oriSwitchHash = true;
      }
    }
  }











  // if ( disabled === 'disabled' && value !== input ) {
  //   switchHash.removeAttribute("disabled");
  //   document.getElementById("switchHashlabel").removeAttribute("class");

  //   // submitButton.removeAttribute("disabled");
  //   // document.getElementById("submitButton").className = "saveButton ";
  //   oriInputHash = true;

  // } else if ( value === input ) {
  //   switchHash.setAttribute("disabled", "disabled");
  //   document.getElementById("switchHashlabel").setAttribute("class", "muted");

  //   // submitButton.setAttribute("disabled", "disabled");
  //   // document.getElementById("submitButton").className = "saveButton disabledButton";
  //   oriInputHash = false;

  //   // switch off switch if previously on
  //   if ( checkbox === true ) {
  //     document.getElementById('switchHash').checked = false;

  //     // check difference for update button
  //     if ( oriSwitchHash ) {
  //       oriSwitchHash = false;
  //     } else {
  //       oriSwitchHash = true;
  //     }
  //   }

  // }

  checkSwitchChange();
}

var toggleAttributesMasterNoti = function() {

  $('#hidden').removeClass('show');

  // check difference for update button
  if ( oriSwitchMasterNoti ) {
    oriSwitchMasterNoti = false;
  } else {
    oriSwitchMasterNoti = true;
  }
  checkSwitchChange();
};
