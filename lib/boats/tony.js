var Bacon = require("baconjs").Bacon;
var n2kMessages = require("../../webapp/lib/messages.js").messages;
var navi = require('../naviutils.js');

/**
 var sources = {
  n2k: new StreamBundle(function(msg){return msg.pgn;}),
  nmea: {
    raw: new Bacon.Bus(),
    json: new Bacon.Bus()
  },
  gaugeData: new StreamBundle()
}
 **/



exports.boat = {
  configureStreams: function (streams) {
    streams.gaugeData.plug(streams.n2k.getTypeStream(n2kMessages.WATERDEPTH).map(function (msg) {
      return {
        type: 'depth',
        depth: msg.fields.Depth
      }
    }), 'depth');
    streams.gaugeData.plug(streams.n2k.getTypeStream(n2kMessages.TEMPERATURE).map(function (msg) {
        return {
                  type: 'temperature',
                  temperature: msg.fields['Actual Temperature']
        }
    }), 'temperature');
    /* { type: 'nav-info',
     timestamp: '065335.00',
     status: 'valid',
     lat: '6008.634',
     latPole: 'N',
     lon: '02453.922',
     lonPole: 'E',
     speedKnots: 5.9,
     trackTrue: 163.4,
     date: '220913',
     variation: 8.1,
     variationPole: 'E',
     talker_id: 'II' }*/
    streams.gaugeData.plug(streams.nmea.json.filter(function (msg) {
      return msg.type === 'nav-info'
    }).flatMap(function (msg) {
        return Bacon.fromArray([
          {
            type: 'course',
            heading: msg.trackTrue},
          {
            type: 'speed',
            knots: msg.speedKnots
          },
          {
            type: 'position',
            lat: Number(msg.lat.substring(0, 2)) + Number(msg.lat.substring(2, msg.lat.length)) / 60,
            lon: Number(msg.lon.substring(0, 3)) + Number(msg.lon.substring(3, msg.lon.length) / 60)
          }
        ]);
      }));

    streams.gaugeData.plug(streams.nmea.json.filter(
      function (msg) {
        return msg.type === '2waypoint'
      }).map(function (msg) {
        return  {
          type: '2waypoint',
          bearing: Number(msg.bearingtrue),
          distance: Number(msg.distance),
          vmg: Number(0)
        };
      })
    );


    var apparentWind = streams.n2k.getTypeStream(n2kMessages.WIND).map(
      function (n2k) {
        return {
          type: 'wind',
          reference: 'apparent',
          angle: n2k.fields['Wind Angle'],
          speed: n2k.fields['Wind Speed']
        }
      });
    streams.gaugeData.plug(apparentWind);
    var sogKnots = streams.nmea.json.filter(function (n) {
      return n.type == 'nav-info'
    }).map('.speedKnots');
    streams.gaugeData.plug(sogKnots.combine(apparentWind, function (sogInKnots, awInfo) {
       return {
        type: 'wind',
        reference: 'true boat',
        speed: navi.getTrueWindSpeed(navi.knots2MetersPerSecond(sogInKnots), awInfo.speed, awInfo.angle),
        angle: navi.getTrueWindAngle(navi.knots2MetersPerSecond(sogInKnots), awInfo.speed, awInfo.angle)
      };
    }));
  }
}


