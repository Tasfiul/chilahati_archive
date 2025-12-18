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
                // User is logged in but is just Level 3
                req.flash('error_msg', 'You are not authorized to access this page.');
                res.redirect('/');
            }
        } else {
            res.redirect('/login');
        }
    }
};