var CONFIDENCES = [
    { name: 'Confident', value: '1.13' },
    { name: 'Easily Delayed', value: '1.65' },
    { name: 'Ambiguous/Unclear', value: '7.39' },
];

var MIN_LIKELIHOODS = [
    0.25,
    0.35,
    0.45,
    0.5,
    0.65,
    0.75
];

function template_item(title) {
    return {
        title: title,
        min_days: '1',
        max_days: Math.round(Math.random() * 30) + '',
        min_likelihood: '0.5',
        confidence: '1.65'
    }
}

function template_stage(title, items) {
    return {
        title: title,
        items: items
    };
}

function calculate_item(item) {
    var min = parseFloat(item.min_days);
    var max = parseFloat(item.max_days);
    var min_likelihood = parseFloat(item.min_likelihood);
    var confidence = parseFloat(item.confidence);

    var weightedMeanDays = ((min * min_likelihood) + (max * (1.0 - min_likelihood)));

    var confidenceAdjustedMin = weightedMeanDays * (1 / confidence);
    var confidenceAdjustedMax = weightedMeanDays * confidence;

    return {
        min_days: min,
        max_days: max,
        min_likelihood: min_likelihood,
        confidence: confidence,
        weighted_mean_days: weightedMeanDays,
        confidence_min_days: confidenceAdjustedMin,
        confidence_max_days: confidenceAdjustedMax,
        title: item.title,
    };
}

function calculate_stage(stage) {
    let c_items = stage.items.map(calculate_item);

    let min = Math.max.apply(null, c_items.map(i => i.confidence_min_days));
    let max = Math.max.apply(null, c_items.map(i => i.confidence_max_days));

    let causes = [];

    c_items.forEach(i => {
        if (i.confidence_max_days == max) {
            causes.push(i);
        }
    });

    return {
        confidence_min_days: min,
        confidence_max_days: max,
        max_cause: causes,
        items: c_items,
        title: stage.title,
    };
}

function calculate_total(obj) {
    console.log('calculating total');

    let c_stages = obj.stages.map(function (s) {
        return calculate_stage(s);
    });

    var previousStagesMaxDays = c_stages
        .slice(0, obj.start_date_stage_idx)
        .map(function (s) { return s.confidence_max_days; })
        .reduce(function (a, b) { return a + b; }, 0);

    var start = moment(obj.start_date).businessAdd(-previousStagesMaxDays);

    let prev_min = start;
    let prev_max = start;

    c_stages = c_stages.map(function (stage) {
        let obj = Object.assign(stage, {
            confidence_min_moment: prev_min.businessAdd(stage.confidence_min_days),
            confidence_max_moment: prev_max.businessAdd(stage.confidence_max_days),
        });

        prev_min = stage.confidence_min_moment;
        prev_max = stage.confidence_max_moment;

        return obj;
    });

    let min = c_stages.map(i => i.confidence_min_days).reduce((a, b) => a + b, 0);
    let max = c_stages.map(i => i.confidence_max_days).reduce((a, b) => a + b, 0);

    return {
        start_date: start.format('YYYY-MM-DD'),
        start_moment: start,
        confidence_min_days: min,
        confidence_max_days: max,
        confidence_min_moment: start.businessAdd(min),
        confidence_max_moment: start.businessAdd(max),
        stages: c_stages
    };
}

/**
 * Vue filter to round the decimal to the given place.
 * http://jsfiddle.net/bryan_k/3ova17y9/
 *
 * @param {String} value    The value string.
 * @param {Number} decimals The number of decimal places.
 */
Vue.filter('round', function (value, decimals) {
    if (!value) {
        value = 0;
    }

    if (!decimals) {
        decimals = 0;
    }

    value = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    return value;
});

let tmpl = {
    start_date: (new Date).toISOString().split('T')[0],
    start_date_stage_idx: '0',
    stages: [
        template_stage('Speccing', [
            template_item('Product Spec'),
            template_item('Technical Spec'),
        ]),
        template_stage('Implementation', [
            template_item('Engineering Effort'),
            template_item('3rd Party Vendor Sandbox Setup'),
            template_item('3rd Party Vendor Production Setup'),
            template_item('Interdepartmental Configuration of Vendor'),
        ]),
        template_stage('QA Testing + Fixes', [
            template_item('SoftServe QA testing + fixes'),
            template_item('Internal feature validation'),
        ]),
        template_stage('Release', [
            template_item('Deploy'),
            template_item('Write Docs'),
            template_item('Production testing'),
            template_item('Validate results with stakeholders'),
        ]),
    ]
};

var app = new Vue({
    el: '#root',
    methods: {
        enforceMinimum: function (evt, item) {
            let newVal = parseFloat(evt.target.value);

            if (newVal < 1) {
                item.min_days = '1';
            }

            if (newVal > parseFloat(item.max_days)) {
                item.max_days = evt.target.value;
            }
        },
        enforceMaximum: function (evt, item) {
            let newVal = parseFloat(evt.target.value);

            if (newVal < 1) {
                item.max_days = '1';
            }

            if (newVal < parseFloat(item.min_days)) {
                item.min_days = evt.target.value;
            }
        },
        calculatedTotal: function (template) {
            return calculate_total(template);
        },
        textareaDates: function () {
            return [
                ["Start Date"].concat(this.calculated.stages.map(s => s.title)).join("\t"),
                [this.calculated.start_date].concat(this.calculated.stages.map(s => s.confidence_max_moment.format('YYYY-MM-DD'))).join("\t"),
            ].join("\n");
        },
        textareaDays: function () {
            return [
                ["Start Date"].concat(this.calculated.stages.map(s => s.title)).join("\t"),
                [this.calculated.start_date].concat(this.calculated.stages.map(s => Math.round(s.confidence_max_days * 10, 1) / 10)).join("\t"),
            ].join("\n");
        },
        isMaxItem: function (stage_idx, item_idx) {
            var stage = this.calculated.stages[stage_idx];

            for (var i = 0; i < stage.items.length; i++) {
                var item = stage.items[i];

                if (stage.confidence_max_days == item.confidence_max_days && i == item_idx) {
                    return true;
                }
            }

            return false;
        },
        isAmbiguous: function (item) {
            return item.confidence == '7.39';
        }
    },
    beforeUpdate: function () {
        this.calculated = calculate_total(this.template);

        var template = this.template;
        // no need to block a render
        setTimeout(function () {
            persist_template(template);
        }, 0);
    },
    data: {
        consts: {
            confidences: CONFIDENCES,
            min_likelihoods: MIN_LIKELIHOODS
        },
        calculated: calculate_total(tmpl),
        template: tmpl
    }
});

function persist_template(tmpl) {
    var encoded = btoa(JSON.stringify(tmpl));

    if (location.hash.substr(3) != encoded) {
        location.hash = "r=" + encoded;
    }
}

if (location.hash.indexOf("#r=") === 0) {
    try {
        app.template = Object.assign(
            { start_date_stage_idx: 0 },
            JSON.parse(atob(location.hash.substr(3)))
        );
    }
    catch (e) {
        // no worries, just clear out the invalid hash
        location.hash = ""
    }
}
else {
    persist_template(app.template);
}
