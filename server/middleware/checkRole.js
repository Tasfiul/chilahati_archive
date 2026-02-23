module.exports = {
    // Check if user is logged in
    ensureAuthenticated: function (req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Please log in to view that resource');
        res.redirect('/login');
    },

    // Check if user is Admin (Level 1) or Supervisor (Level 2)
    ensureStaff: function (req, res, next) {
        if (req.isAuthenticated()) {
            if (req.user.role === 'admin' || req.user.role === 'supervisor') {
                return next();
            } else {
                req.flash('error_msg', 'You are not authorized to access this page.');
                res.redirect('/');
            }
        } else {
            res.redirect('/login');
        }
    },

    // Strictly Level 1 (Admin Only)
    ensureAdmin: function (req, res, next) {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        req.flash('error_msg', 'Access denied. Administrator privileges required.');
        res.redirect('/');
    }
};