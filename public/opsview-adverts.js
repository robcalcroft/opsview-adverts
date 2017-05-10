/* eslint-disable */
var sizes = ['640x960', '500x300', '600x200'];
var s3BaseUrl = 'https://s3.amazonaws.com/';
var s3Bucket = 'opsview-adverts-testing';

var formListener = function() {
  $('#addAdvert').submit(function(event) {
    event.preventDefault();
    var advertLoader = $('addAdvert__loader');

    advertLoader.show();

    $.ajax({
      url: '/api/advert/new',
      data: new FormData($(this)[0]),
      method: 'POST',
      processData: false,
      contentType: false,
    })
    .always(function() {
      advertLoader.hide();
    })
    .done(function() {
      window.location.reload();
    })
    .fail(function(error) {
      alert('Failed: ' + error.message);
    });
  });
}

var getCurrentAdverts = function() {
  sizes.forEach(function(size) {
    $.getJSON(s3BaseUrl + s3Bucket + '/' + size + '/advert.json?time=' + new Date().getTime())
    .always(function() {
      $('#currentAdverts__loader__' + size).hide();
    })
    .done(function(advert) {
      var imageUrl = advert.image_url.split('/');

      $('.currentAdverts__' + size).html(
        '<div class="card-image">' +
          '<img src="' + advert.image_url + '">' +
        '</div>' +
        '<div class="card-stacked">' +
          '<div class="card-content">' +
            '<p>Advert for ' + size + '</p>' +
          '</div>' +
          '<div class="card-action">' +
            '<a href="' + advert.redirect_url + '">Go to redirect URL</a>' +
            '<a href="#" onClick="deleteButtonListener(\'' + imageUrl[imageUrl.length - 1] + '\');" class="deleteButton">Delete</a>' +
          '</div>' +
        '</div>'
      );
    })
    .fail(function(error) {
      var sizeMap = {
        '640x960': 'Usually mobile',
        '500x300': 'Usually a login screen',
        '600x200': 'Usually used for product reload',
      };
      $('.currentAdverts__' + size + ' > .card-content').html('No advert available for ' + size + ' (' + sizeMap[size] + ')');
    });
  });
}

var toggleAdsListener = function() {
  $('button#toggleAds').click(function() {
    var areAdsEnabled = $(this).attr('data-enabled');
    $(this).html('Loading...');
    $.post('/api/status', { enabled: areAdsEnabled === '1' ? 0 : 1 })
    .always(function() {
      window.location.reload();
    });
  });
}

var getToggleAdButtonText = function() {
  var button = $('button#toggleAds');
  $.getJSON('/api/status')
  .done(function(data) {
    button.html(data.result.enabled ? 'Disable Ads' : 'Enable Ads');
    button.attr('data-enabled', data.result.enabled);
    if (!data.result.enabled) {
      $('#advertOfflineMessage').show();
    }
  })
  .fail(function(data) {
    button.html('Error');
  });
}

var deleteButtonListener = function(image) {
  $.ajax({
    url: '/api/advert?image_name=' + image,
    method: 'DELETE',
  })
  .done(function() {
    window.location.reload();
  })
  .fail(function() {
    console.log('fail')
  });
}

$(function() {
  // Listens to submissions for new adverts
  formListener();
  // Gets the current ads from S3
  getCurrentAdverts();
  // Listens for a click on the toggle ad status button
  toggleAdsListener();
  // Sets the text on the toggle ad status button
  getToggleAdButtonText();
  // Materialize initialisation
  $('select').material_select();
  $('.modal').modal();
});

// var getAdverts = function() {
//   $.getJSON('/api/advert')
//   .done(function(data) {
//     // The database stores the target versions as a JSON array so we need to parse it into a usable
//     // object
//     var adverts = data.result;
//     var createRow = function() {
//       return $('<div></div>').addClass('list-advert__row');
//     }
//
//     $('#list-advert-loader').hide();
//
//     adverts.forEach(function(advert) {
//       var row = createRow().append(
//         '<div>' + advert.name + '</div>' +
//         '<a target="_blank" href="' + advert.redirect_url + '">' + advert.redirect_url + '</a>' +
//         '<div>Added ' + moment.unix(advert.created).fromNow() + '</div>' +
//         '<div>' + advert.target_size + '</div>' +
//         '<img width="50%" src="https://s3.amazonaws.com/opsview-adverts-testing/' + advert.target_size + '/' + advert.image_name + '" />'
//       );
//       $('.list-adverts').append(row);
//     });
//   })
//   .fail(function(error) {
//     console.log(error);
//   });
// }
