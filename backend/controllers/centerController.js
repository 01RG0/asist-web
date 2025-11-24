const Center = require('../models/Center');
const { logAuditAction } = require('../utils/auditLogger');

/**
 * Get all centers
 * GET /api/centers
 */
const getAllCenters = async (req, res) => {
    try {
        const centers = await Center.find()
            .select('_id name latitude longitude radius_m address createdAt')
            .sort({ name: 1 })
            .lean();

        // Transform _id to id for frontend compatibility
        const formattedCenters = centers.map(center => ({
            id: center._id,
            name: center.name,
            latitude: center.latitude,
            longitude: center.longitude,
            radius_m: center.radius_m,
            address: center.address,
            created_at: center.createdAt
        }));

        res.json({
            success: true,
            data: formattedCenters
        });
    } catch (error) {
        console.error('Get centers error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching centers'
        });
    }
};

/**
 * Create new center (Admin only)
 * POST /api/centers
 */
const createCenter = async (req, res) => {
    try {
        const { name, latitude, longitude, radius_m = 30, address } = req.body;

        if (!name || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Name, latitude, and longitude are required'
            });
        }

        const newCenter = new Center({
            name,
            latitude,
            longitude,
            radius_m,
            address
        });

        await newCenter.save();

        // Log the action
        await logAuditAction(req.user.id, 'CREATE_CENTER', {
            center_id: newCenter._id.toString(),
            name,
            latitude,
            longitude,
            radius_m,
            address
        });

        res.status(201).json({
            success: true,
            message: 'Center created successfully',
            data: {
                id: newCenter._id,
                name: newCenter.name,
                latitude: newCenter.latitude,
                longitude: newCenter.longitude,
                radius_m: newCenter.radius_m,
                address: newCenter.address
            }
        });
    } catch (error) {
        console.error('Create center error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating center'
        });
    }
};

/**
 * Update center (Admin only)
 * PUT /api/centers/:id
 */
const updateCenter = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, latitude, longitude, radius_m, address } = req.body;

        // Build update object with only provided fields
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (radius_m !== undefined) updateData.radius_m = radius_m;
        if (address !== undefined) updateData.address = address;

        const updatedCenter = await Center.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedCenter) {
            return res.status(404).json({
                success: false,
                message: 'Center not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'UPDATE_CENTER', {
            center_id: id,
            ...updateData
        });

        res.json({
            success: true,
            message: 'Center updated successfully'
        });
    } catch (error) {
        console.error('Update center error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating center'
        });
    }
};

/**
 * Get single center by ID
 * GET /api/centers/:id
 */
const getCenterById = async (req, res) => {
    try {
        const { id } = req.params;

        const center = await Center.findById(id)
            .select('_id name latitude longitude radius_m address createdAt')
            .lean();

        if (!center) {
            return res.status(404).json({
                success: false,
                message: 'Center not found'
            });
        }

        // Transform for frontend compatibility
        const formattedCenter = {
            id: center._id,
            name: center.name,
            latitude: center.latitude,
            longitude: center.longitude,
            radius_m: center.radius_m,
            address: center.address,
            created_at: center.createdAt
        };

        res.json({
            success: true,
            data: formattedCenter
        });
    } catch (error) {
        console.error('Get center error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching center'
        });
    }
};

/**
 * Delete center (Admin only)
 * DELETE /api/centers/:id
 */
const deleteCenter = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedCenter = await Center.findByIdAndDelete(id);

        if (!deletedCenter) {
            return res.status(404).json({
                success: false,
                message: 'Center not found'
            });
        }

        // Log the action
        await logAuditAction(req.user.id, 'DELETE_CENTER', {
            center_id: id
        });

        res.json({
            success: true,
            message: 'Center deleted successfully'
        });
    } catch (error) {
        console.error('Delete center error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting center'
        });
    }
};

module.exports = {
    getAllCenters,
    getCenterById,
    createCenter,
    updateCenter,
    deleteCenter
};
