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
    .done(function(data) {
      console.log('done', data);
    })
    .fail(function(error) {
      console.log('fail', error)
    });
  });
}

var getCurrentAdverts = function() {
  sizes.forEach(function(size) {
    $.getJSON(s3BaseUrl + s3Bucket + '/' + size + '/advert.json')
    .always(function() {
      $('#currentAdverts__loader__' + size).hide();
    })
    .done(function(advert) {
      $('#currentAdverts__body__' + size).html(
        '<div>Redirect Link: <a href="' + advert.redirect_url + '">' + advert.redirect_url + '</a></div>' +
        '<img width="50%" src="' + advert.image_url + '" />'
      );
    })
    .fail(function(error) {
      $('#currentAdverts__body__' + size).html('Error loading advert');
    });
  });
}

var toggleAdsListener = function() {
  $('button#toggleAds').click(function() {
    var buttonText = $(this).html();
    $(this).html('Loading...');
    $.post('/api/status', { enabled: false })
    .always(function() {
      $(this).html(buttonText);
    }.bind(this));
  });
}

$(function() {
  formListener();
  getCurrentAdverts();
  toggleAdsListener();
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
